"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { automationService } from "@/features/properties/services/automation-service"
import type { AutomationStatusItem } from "@/features/properties/types/automation"

const POLL_INTERVAL_MS = 10_000
const COOLDOWN_SECONDS = 300

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
    /** automationUuid → epoch ms until which a 429 cooldown applies. */
    cooldownUntil: Record<string, number>
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
    const [cooldownUntil, setCooldownUntil] = useState<Record<string, number>>({})

    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mountedRef = useRef(true)

    /**
     * Start a 5-minute cooldown for an automation. The backend returns 429 without
     * a Retry-After header or remaining-seconds body, so we anchor the countdown to
     * the moment we receive the 429 (per the API spec).
     */
    const startCooldown = useCallback((automationUuid: string) => {
        setCooldownUntil(prev => ({ ...prev, [automationUuid]: Date.now() + COOLDOWN_SECONDS * 1000 }))
    }, [])

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
                startCooldown(item.automationUuid)
                toast.error("Espera unos minutos antes de reintentar esta automatización.")
            } else if (status === 422) {
                // The record is no longer the latest, or no longer "failed" (a retry
                // resolved it). The backend returns a translated reason — surface it
                // and re-sync so the buttons reflect the new state.
                toast.info(message || "El estado cambió. Actualizamos la información.")
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
    }, [reservationUuid, fetchStatus, scheduleNext, startCooldown])

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
                startCooldown(item.automationUuid)
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
    }, [reservationUuid, fetchStatus, scheduleNext, startCooldown])

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
                startCooldown(item.automationUuid)
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
    }, [reservationUuid, startCooldown])

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

    // 1s ticking clock — only runs while an explicit 429 cooldown is active. We no
    // longer derive a cooldown from lastRunAt: the backend's 5-min limit doesn't
    // apply to admin tokens, so we wait for a real 429 instead of pre-blocking.
    useEffect(() => {
        const anyExplicitCooldown = Object.values(cooldownUntil).some(until => until > now)
        if (!anyExplicitCooldown) return
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [now, cooldownUntil])

    return { items, isLoading, error, redispatchingUuids, dispatchingUuids, now, cooldownUntil, refresh, redispatch, dispatch, resendPdf }
}
