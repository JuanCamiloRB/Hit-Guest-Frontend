import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Reservation } from "@/types"

/**
 * Criterio de aceptación de la auditoría 2 (2026-11-04): con el limitador
 * REAL y compartido, seis peticiones colgadas no bloquean la carga siguiente.
 * Solo se doblan la lista de reservas y la petición HTTP por reserva.
 */

const mocks = vi.hoisted(() => ({ list: vi.fn(), listUsageRecords: vi.fn() }))

vi.mock("@/features/reservations/services/reservations-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/reservations/services/reservations-service")>()),
    reservationsService: { list: mocks.list },
}))
vi.mock("@/features/properties/services/automation-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/properties/services/automation-service")>()),
    automationService: { listUsageRecords: mocks.listUsageRecords },
}))

import { useBillingData, type ConsumptionStatus } from "./useBillingData"

const RESERVATIONS = Array.from({ length: 30 }, (_, i) => ({
    id: `r-${i}`,
    guestName: `Huésped ${i}`,
    unitName: "101",
    propertyName: "Pullman",
    checkIn: new Date(),
})) as unknown as Reservation[]

describe("useBillingData — reintentar libera el limitador aunque haya peticiones colgadas", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.list.mockResolvedValue(RESERVATIONS)
    })

    it("aborta las seis colgadas, no despacha las 24 en cola y la carga nueva termina", async () => {
        let hang = true
        let running = 0
        let peak = 0
        const firstLoadSignals: AbortSignal[] = []
        const abortedInFlight: string[] = []

        mocks.listUsageRecords.mockImplementation((id: string, _automationUuid: undefined, signal: AbortSignal) => {
            running += 1
            peak = Math.max(peak, running)
            if (hang) {
                firstLoadSignals.push(signal)
                // Como fetch: no responde nunca, salvo que la señal lo cancele.
                return new Promise((_, reject) => {
                    signal.addEventListener("abort", () => {
                        running -= 1
                        abortedInFlight.push(id)
                        reject(new DOMException("The operation was aborted.", "AbortError"))
                    })
                })
            }
            return new Promise((resolve) => setTimeout(() => {
                running -= 1
                resolve([])
            }, 1))
        })

        const statuses: ConsumptionStatus[] = []
        const { result } = renderHook(() => {
            const data = useBillingData()
            statuses.push(data.status)
            return data
        })

        // 1. La primera carga ocupa los seis espacios con peticiones colgadas.
        await waitFor(() => expect(mocks.listUsageRecords).toHaveBeenCalledTimes(6))
        expect(running).toBe(6)

        // 2. El usuario pulsa «Reintentar».
        hang = false
        act(() => result.current.retry())

        // 3–5. Las seis anteriores se abortan, el limitador se libera y la carga nueva termina.
        await waitFor(() => expect(result.current.status).toBe("ready"))
        expect(abortedInFlight).toHaveLength(6)
        expect(firstLoadSignals).toHaveLength(6)
        expect(firstLoadSignals.every((signal) => signal.aborted)).toBe(true)
        // Las 24 que esperaban turno en la carga cancelada nunca salieron:
        // 6 colgadas + 30 de la carga nueva.
        expect(mocks.listUsageRecords).toHaveBeenCalledTimes(36)
        expect(peak).toBeLessThanOrEqual(6)

        // 7. Solo la carga nueva actualiza el tablero.
        expect(result.current.costs).toHaveLength(30)
        expect(result.current.failedReservations).toEqual([])
        expect(statuses).not.toContain("error")
        expect(statuses).not.toContain("partial")

        // 6. Ninguna cancelación llega a la consola.
        expect(console.error).not.toHaveBeenCalled()
    })

    it("desmontar también libera el limitador: volver al tablero carga normalmente", async () => {
        mocks.listUsageRecords.mockImplementation((_id: string, _a: undefined, signal: AbortSignal) =>
            new Promise((_, reject) => {
                signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")))
            }))

        const first = renderHook(() => useBillingData())
        await waitFor(() => expect(mocks.listUsageRecords).toHaveBeenCalledTimes(6))
        first.unmount()

        mocks.listUsageRecords.mockImplementation(async () => [])
        const second = renderHook(() => useBillingData())

        await waitFor(() => expect(second.result.current.status).toBe("ready"))
        expect(second.result.current.costs).toHaveLength(30)
        expect(mocks.listUsageRecords).toHaveBeenCalledTimes(36)
        expect(console.error).not.toHaveBeenCalled()
    })
})
