"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { automationService } from "@/features/properties/services/automation-service"
import type { AutomationStatusItem } from "@/features/properties/types/automation"

const POLL_INTERVAL_MS = 10_000
const COOLDOWN_SECONDS = 300

/** Parses a backend UTC timestamp ("YYYY-MM-DD HH:mm:ss") into a Date. */
function parseUtc(ts: string | null): Date | null {
    if (!ts) return null
    const normalized = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z"
    const d = new Date(normalized)
    return Number.isNaN(d.getTime()) ? null : d
}

/** Remaining cooldown seconds for an item, based on its lastRunAt (0 if none). */
export function getCooldownSecondsRemaining(item: AutomationStatusItem, now: number = Date.now()): number {
    const lastRun = parseUtc(item.lastRunAt)
    if (!lastRun) return 0
    const elapsed = (now - lastRun.getTime()) / 1000
    return Math.max(0, Math.ceil(COOLDOWN_SECONDS - elapsed))
}

interface UseAutomationStatusResult {
    items: AutomationStatusItem[]
    isLoading: boolean
    error: string | null
    /** Item uuids currently being re-dispatched (in-flight request). */
    redispatchingUuids: Set<string>
    /** Item uuids currently being dispatched for the first time (in-flight request). */
    dispatchingUuids: Set<string>
    /** Ticking clock (ms) so consumers can recompute cooldowns each second. */
    now: number
    refresh: () => Promise<void>
    redispatch: (item: AutomationStatusItem) => Promise<void>
    /** Manually trigger a not-yet-run automation (status "not_started"). */
    dispatch: (item: AutomationStatusItem) => Promise<void>
    /** Resend the Guest Report PDF email for a completed automation. */
    resendPdf: (item: AutomationStatusItem) => Promise<void>
}

export function useAutomationStatus(reservationUuid: string): UseAutomationStatusResult {
    const [items, setItems] = useState<AutomationStatusItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [redispatchingUuids, setRedispatchingUuids] = useState<Set<string>>(new Set())
    const [dispatchingUuids, setDispatchingUuids] = useState<Set<string>>(new Set())
    const [now, setNow] = useState(() => Date.now())

    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(true)

    const hasPending = useCallback(
        (list: AutomationStatusItem[]) => list.some(i => i.status === "pending"),
        [],
    )

    const fetchStatus = useCallback(async (): Promise<AutomationStatusItem[]> => {
        const data = await automationService.getReservationStatus(reservationUuid)
        if (mountedRef.current) {
            setItems(data)
            setError(null)
        }
        return data
    }, [reservationUuid])

    const scheduleNext = useCallback((list: AutomationStatusItem[]) => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        if (!hasPending(list)) return
        pollTimerRef.current = setTimeout(async () => {
            try {
                const data = await fetchStatus()
                scheduleNext(data)
            } catch {
                // Network blip — keep polling on the same cadence.
                scheduleNext(list)
            }
        }, POLL_INTERVAL_MS)
    }, [fetchStatus, hasPending])

    const refresh = useCallback(async () => {
        try {
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (e: any) {
            if (mountedRef.current) setError(e?.message || "Error al cargar el estado de automatizaciones")
        }
    }, [fetchStatus, scheduleNext])

    const redispatch = useCallback(async (item: AutomationStatusItem) => {
        if (item.usageRecordId == null) return
        setRedispatchingUuids(prev => new Set(prev).add(item.automationUuid))
        try {
            await automationService.redispatch(reservationUuid, item.usageRecordId)
            toast.success(`"${item.automationName}" reenviada. Procesando...`)
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (e: any) {
            const status = e?.status
            const message: string = e?.message || ""
            if (status === 429) {
                toast.error("Espera unos minutos antes de reintentar esta automatización.")
            } else if (status === 422 && message.includes("latest execution record")) {
                // Race: a newer record exists — re-sync silently and let the user retry.
                toast.info("Estado actualizado. Vuelve a intentarlo.")
                const data = await fetchStatus()
                scheduleNext(data)
            } else if (status === 422) {
                // Record is no longer "failed" (e.g. resolved by a successful retry).
                toast.info("Esta automatización ya no requiere reenvío.")
                const data = await fetchStatus()
                scheduleNext(data)
            } else {
                toast.error(message || "No se pudo reenviar la automatización.")
            }
        } finally {
            if (mountedRef.current) {
                setRedispatchingUuids(prev => {
                    const next = new Set(prev)
                    next.delete(item.automationUuid)
                    return next
                })
            }
        }
    }, [reservationUuid, fetchStatus, scheduleNext])

    const dispatch = useCallback(async (item: AutomationStatusItem) => {
        if (!item.automationUuid) return
        setDispatchingUuids(prev => new Set(prev).add(item.automationUuid))
        try {
            await automationService.dispatch(reservationUuid, item.automationUuid)
            toast.success(`"${item.automationName}" disparada. Procesando...`)
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (e: any) {
            const status = e?.status
            const message: string = e?.message || ""
            if (status === 429) {
                toast.error("Espera unos minutos antes de volver a dispararla.")
            } else if (status === 422) {
                // Inactive / already run / failed (use redispatch) / no job handler.
                toast.info(message || "Esta automatización no se puede disparar en este momento.")
                const data = await fetchStatus()
                scheduleNext(data)
            } else if (status === 404) {
                toast.error("No se encontró la automatización para esta reserva.")
            } else {
                toast.error(message || "No se pudo disparar la automatización.")
            }
        } finally {
            if (mountedRef.current) {
                setDispatchingUuids(prev => {
                    const next = new Set(prev)
                    next.delete(item.automationUuid)
                    return next
                })
            }
        }
    }, [reservationUuid, fetchStatus, scheduleNext])

    const resendPdf = useCallback(async (item: AutomationStatusItem) => {
        if (!item.automationUuid) return
        setDispatchingUuids(prev => new Set(prev).add(item.automationUuid))
        try {
            await automationService.resendPdf(reservationUuid, item.automationUuid)
            toast.success("Reporte PDF reenviado al correo.")
        } catch (e: any) {
            const status = e?.status
            const message: string = e?.message || ""
            if (status === 429) {
                toast.error("Espera unos minutos antes de reenviar el reporte.")
            } else if (status === 422) {
                toast.info(message || "No se puede reenviar el reporte en este momento.")
            } else if (status === 404) {
                toast.error("No se encontró la automatización para esta reserva.")
            } else {
                toast.error(message || "No se pudo reenviar el reporte PDF.")
            }
        } finally {
            if (mountedRef.current) {
                setDispatchingUuids(prev => {
                    const next = new Set(prev)
                    next.delete(item.automationUuid)
                    return next
                })
            }
        }
    }, [reservationUuid])

    // Initial load + polling setup
    useEffect(() => {
        mountedRef.current = true
        setIsLoading(true)
        ;(async () => {
            try {
                const data = await fetchStatus()
                scheduleNext(data)
            } catch (e: any) {
                if (mountedRef.current) setError(e?.message || "Error al cargar el estado de automatizaciones")
            } finally {
                if (mountedRef.current) setIsLoading(false)
            }
        })()
        return () => {
            mountedRef.current = false
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        }
    }, [fetchStatus, scheduleNext])

    // 1s ticking clock — only runs while any item is within cooldown.
    useEffect(() => {
        const anyCooldown = items.some(i => i.canRedispatch && getCooldownSecondsRemaining(i, now) > 0)
        if (!anyCooldown) return
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [items, now])

    return { items, isLoading, error, redispatchingUuids, dispatchingUuids, now, refresh, redispatch, dispatch, resendPdf }
}
