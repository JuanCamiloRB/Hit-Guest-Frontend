"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { normalizeApiError } from "@/lib/notify-error"
import { automationService } from "@/features/properties/services/automation-service"
import type { AutomationGuestStatus, AutomationStatusItem } from "@/features/properties/types/automation"
import { readInactiveResourceError } from "@/lib/inactive-resource"

const POLL_INTERVAL_MS = 10_000
const COOLDOWN_SECONDS = 300

/**
 * Clave de una acción: la automatización y, si es por huésped, el huésped
 * (contrato 2026-10-27 §2.4). Dos huéspedes de SIRE comparten automatización,
 * y el enfriamiento de 5 minutos del backend se cuenta POR HUÉSPED: con la
 * clave de la automatización sola, reintentar a uno bloqueaba al otro.
 */
export function automationActionKey(automationUuid: string, guestUuid?: string | null): string {
    return `${automationUuid}:${guestUuid ?? "reservation"}`
}

/** Alojamiento o propiedad inactivos (contrato 2026-10-27 §2.4): error, con el mensaje del backend. */
function showInactive(error: unknown, title: string): boolean {
    const inactive = readInactiveResourceError(error)
    if (!inactive) return false
    toast.error(title, { description: inactive.message })
    return true
}

/** Algo sigue procesándose: la automatización o alguno de sus huéspedes. */
export function hasPendingWork(list: AutomationStatusItem[]): boolean {
    return list.some((item) => item.status === "pending" || (item.guests ?? []).some((guest) => guest.status === "pending"))
}

interface UseAutomationStatusResult {
    items: AutomationStatusItem[]
    isLoading: boolean
    error: string | null
    /** Claves (`automationActionKey`) con un reintento en vuelo. */
    redispatchingKeys: Set<string>
    /** Claves (`automationActionKey`) con un despacho o reenvío en vuelo. */
    dispatchingKeys: Set<string>
    /** Ticking clock (ms) so consumers can recompute cooldowns each second. */
    now: number
    /** `automationActionKey` → epoch ms until which a 429 cooldown applies. */
    cooldownUntil: Record<string, number>
    refresh: () => Promise<void>
    /** Reintenta la automatización o, con `guest`, solo a ese huésped (su `usageRecordId`). */
    redispatch: (item: AutomationStatusItem, guest?: AutomationGuestStatus) => Promise<void>
    /** Despacha la automatización; sin `guest`, a todos los huéspedes elegibles. */
    dispatch: (item: AutomationStatusItem, guest?: AutomationGuestStatus) => Promise<void>
    /** Resend the Guest Report PDF email for a completed automation. */
    resendPdf: (item: AutomationStatusItem) => Promise<void>
}

export function useAutomationStatus(reservationUuid: string): UseAutomationStatusResult {
    const [items, setItems] = useState<AutomationStatusItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [redispatchingKeys, setRedispatchingKeys] = useState<Set<string>>(new Set())
    const [dispatchingKeys, setDispatchingKeys] = useState<Set<string>>(new Set())
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
    const startCooldown = useCallback((key: string) => {
        setCooldownUntil(prev => ({ ...prev, [key]: Date.now() + COOLDOWN_SECONDS * 1000 }))
    }, [])

    const hasPending = hasPendingWork

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

    const redispatch = useCallback(async (item: AutomationStatusItem, guest?: AutomationGuestStatus) => {
        const recordId = guest ? guest.usageRecordId : item.usageRecordId
        if (recordId == null) return
        const key = automationActionKey(item.automationUuid, guest?.guestUuid)
        setRedispatchingKeys(prev => new Set(prev).add(key))
        try {
            await automationService.redispatch(reservationUuid, recordId)
            toast.success(guest ? `"${item.automationName}" reenviada para ${guest.name}. Procesando...` : `"${item.automationName}" reenviada. Procesando...`)
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (error: unknown) {
            const { status, message } = normalizeApiError(error, "")
            if (showInactive(error, "No se pudo reintentar la automatización")) {
                // Nada que reintentar mientras siga inactivo.
            } else if (status === 429) {
                startCooldown(key)
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
                setRedispatchingKeys(prev => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            }
        }
    }, [reservationUuid, fetchStatus, scheduleNext, startCooldown, isCurrent])

    const dispatch = useCallback(async (item: AutomationStatusItem, guest?: AutomationGuestStatus) => {
        if (!item.automationUuid) return
        const key = automationActionKey(item.automationUuid, guest?.guestUuid)
        setDispatchingKeys(prev => new Set(prev).add(key))
        try {
            const response = await automationService.dispatch(reservationUuid, item.automationUuid, guest?.guestUuid)
            // El 202 dice para cuántos huéspedes se despachó (§2.4): se muestra tal cual.
            toast.success(response?.message || `"${item.automationName}" disparada. Procesando...`)
            const data = await fetchStatus()
            scheduleNext(data)
        } catch (error: unknown) {
            const { status, message } = normalizeApiError(error, "")
            if (showInactive(error, "No se pudo despachar la automatización")) {
                // Nada que despachar mientras siga inactivo.
            } else if (status === 429) {
                startCooldown(key)
                toast.error("Espera unos minutos antes de volver a dispararla.")
            } else if (status === 422) {
                // Inactive / already run / failed (use redispatch) / no job handler.
                toast.info(message || "Esta automatización no se puede disparar en este momento.")
                const data = await fetchStatus()
                scheduleNext(data)
            } else if (status === 404) {
                // Con `guestUuid`, el 404 es «el huésped no es de la reserva».
                toast.error(message || "No se encontró la automatización para esta reserva.")
                if (guest) await refresh()
            } else {
                toast.error(message || "No se pudo disparar la automatización.")
            }
        } finally {
            if (isCurrent()) {
                setDispatchingKeys(prev => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            }
        }
    }, [reservationUuid, fetchStatus, scheduleNext, startCooldown, isCurrent, refresh])

    const resendPdf = useCallback(async (item: AutomationStatusItem) => {
        if (!item.automationUuid) return
        const key = automationActionKey(item.automationUuid)
        setDispatchingKeys(prev => new Set(prev).add(key))
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
            if (showInactive(error, "No se pudo reenviar el reporte PDF")) {
                // Nada que reenviar mientras siga inactivo.
            } else if (status === 429) {
                startCooldown(key)
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
                setDispatchingKeys(prev => {
                    const next = new Set(prev)
                    next.delete(key)
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

    return { items, isLoading, error, redispatchingKeys, dispatchingKeys, now, cooldownUntil, refresh, redispatch, dispatch, resendPdf }
}
