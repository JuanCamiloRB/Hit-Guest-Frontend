"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { normalizeApiError } from "@/lib/notify-error"
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
     * Reserva cuyo sondeo está vigente.
     *
     * `mountedRef` sola no alcanza cuando CAMBIA la reserva: el cleanup la pone en
     * `false`, el efecto de la reserva nueva la vuelve a poner en `true`, y la
     * petición de la reserva vieja —que seguía en vuelo— responde, ve `true`,
     * escribe datos de otra reserva y reprograma su propio sondeo. Comparar contra
     * el uuid vigente distingue las dos corridas; `mountedRef` sigue cubriendo el
     * desmontaje puro.
     */
    const activeUuidRef = useRef<string | null>(null)
    const isCurrent = useCallback(
        () => mountedRef.current && activeUuidRef.current === reservationUuid,
        [reservationUuid],
    )

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
        if (isCurrent()) {
            setItems(data)
            setError(null)
        }
        return data
    }, [reservationUuid, isCurrent])

    /**
     * Reprograma el sondeo mientras haya algo en `pending`.
     *
     * `mountedRef` se comprueba TAMBIÉN después del await: limpiar el timer al
     * desmontar no cancela una petición en vuelo, y esa continuación volvía a
     * llamar a `scheduleNext()` programando un timer nuevo que ya nadie iba a
     * limpiar — el mismo sondeo zombi que había en el polling de Didit. Sigue
     * pegándole a la API sobre una pantalla que ya no existe.
     */
    const scheduleNext = useCallback(function scheduleNextPoll(list: AutomationStatusItem[]) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        if (!hasPending(list) || !isCurrent()) return
        pollTimerRef.current = setTimeout(async () => {
            if (!isCurrent()) return
            try {
                const data = await fetchStatus()
                if (!isCurrent()) return
                scheduleNextPoll(data)
            } catch {
                // Network blip — keep polling on the same cadence.
                if (!isCurrent()) return
                scheduleNextPoll(list)
            }
        }, POLL_INTERVAL_MS)
    }, [fetchStatus, hasPending, isCurrent])

    const refresh = useCallback(async () => {
        try {
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (error: unknown) {
            if (isCurrent()) setError(normalizeApiError(error, "Error al cargar el estado de automatizaciones").message)
        }
    }, [fetchStatus, scheduleNext, isCurrent])

    const redispatch = useCallback(async (item: AutomationStatusItem) => {
        if (item.usageRecordId == null) return
        setRedispatchingUuids(prev => new Set(prev).add(item.automationUuid))
        try {
            await automationService.redispatch(reservationUuid, item.usageRecordId)
            toast.success(`"${item.automationName}" reenviada. Procesando...`)
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (error: unknown) {
            const { status, message } = normalizeApiError(error, "")
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
            if (isCurrent()) {
                setRedispatchingUuids(prev => {
                    const next = new Set(prev)
                    next.delete(item.automationUuid)
                    return next
                })
            }
        }
    }, [reservationUuid, fetchStatus, scheduleNext, startCooldown, isCurrent])

    const dispatch = useCallback(async (item: AutomationStatusItem) => {
        if (!item.automationUuid) return
        setDispatchingUuids(prev => new Set(prev).add(item.automationUuid))
        try {
            await automationService.dispatch(reservationUuid, item.automationUuid)
            toast.success(`"${item.automationName}" disparada. Procesando...`)
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (error: unknown) {
            const { status, message } = normalizeApiError(error, "")
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
            if (isCurrent()) {
                setDispatchingUuids(prev => {
                    const next = new Set(prev)
                    next.delete(item.automationUuid)
                    return next
                })
            }
        }
    }, [reservationUuid, fetchStatus, scheduleNext, startCooldown, isCurrent])

    const resendPdf = useCallback(async (item: AutomationStatusItem) => {
        if (!item.automationUuid) return
        setDispatchingUuids(prev => new Set(prev).add(item.automationUuid))
        try {
            await automationService.resendPdf(reservationUuid, item.automationUuid)
            toast.success("Reporte PDF reenviado al correo.")
            // El reenvío crea un usage record nuevo. Si el panel estaba estable
            // no había polling activo: resincroniza y vuelve a sondear si queda
            // una ejecución pendiente.
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (error: unknown) {
            const { status, message } = normalizeApiError(error, "")
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
            if (isCurrent()) {
                setDispatchingUuids(prev => {
                    const next = new Set(prev)
                    next.delete(item.automationUuid)
                    return next
                })
            }
        }
    }, [reservationUuid, startCooldown, fetchStatus, scheduleNext, isCurrent])

    // Initial load + polling setup
    useEffect(() => {
        mountedRef.current = true
        activeUuidRef.current = reservationUuid
        setIsLoading(true)
        ;(async () => {
            try {
                const data = await fetchStatus()
                scheduleNext(data)
            } catch (error: unknown) {
                if (isCurrent()) setError(normalizeApiError(error, "Error al cargar el estado de automatizaciones").message)
            } finally {
                if (isCurrent()) setIsLoading(false)
            }
        })()
        return () => {
            mountedRef.current = false
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        }
    }, [fetchStatus, scheduleNext, isCurrent, reservationUuid])

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
