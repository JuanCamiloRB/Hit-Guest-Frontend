"use client"

import { useEffect, useState } from "react"
import { automationService } from "@/features/properties/services/automation-service"
import { throwIfRateLimited } from "@/lib/rate-limit"
import { latestLinkAttempts, type AttemptChannel, type LinkAttempt } from "../lib/link-attempts"

type Attempts = Partial<Record<AttemptChannel, LinkAttempt>>
export type LinkAttemptsState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; attempts: Attempts }
    | { status: "error" }

/** Cuánto vale el historial ya leído de una reserva (como el semáforo por fila). */
export const LINK_ATTEMPTS_FRESH_MS = 2 * 60_000

let memory = new Map<string, { at: number; attempts: Attempts }>()

/** Solo para tests. */
export function resetLinkAttemptsMemory(): void {
    memory = new Map()
}

function fresh(key: string): Attempts | null {
    const hit = memory.get(key)
    return hit && Date.now() - hit.at < LINK_ATTEMPTS_FRESH_MS ? hit.attempts : null
}

/**
 * Los intentos por canal del envío del link de UNA reserva, pedidos recién
 * cuando alguien abre su detalle (el componente se monta al abrir): nunca una
 * petición por fila de la tabla. Filtrado por la automatización de envío, así
 * la respuesta trae solo esos registros. Sin automatización (`null`) no hay
 * nada que buscar: el link sale solo por correo.
 */
export function useLinkAttempts(reservationId: string, automationUuid: string | null): LinkAttemptsState {
    const key = automationUuid ? `${reservationId}:${automationUuid}` : null
    const [state, setState] = useState<LinkAttemptsState>(() => {
        if (!key) return { status: "idle" }
        const cached = fresh(key)
        return cached ? { status: "ready", attempts: cached } : { status: "loading" }
    })

    useEffect(() => {
        if (!key || !automationUuid || fresh(key)) return
        const controller = new AbortController()
        // Cadena `.then()`: `react-hooks/set-state-in-effect` solo acepta setState en callbacks.
        Promise.resolve()
            .then(() => {
                // Tras un 429 no se pide: recibiría lo mismo.
                throwIfRateLimited()
                return automationService.listUsageRecords(reservationId, automationUuid, controller.signal)
            })
            .then((records) => {
                const attempts = latestLinkAttempts(records)
                memory.set(key, { at: Date.now(), attempts })
                if (!controller.signal.aborted) setState({ status: "ready", attempts })
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({ status: "error" })
            })
        return () => controller.abort()
    }, [key, reservationId, automationUuid])

    return state
}
