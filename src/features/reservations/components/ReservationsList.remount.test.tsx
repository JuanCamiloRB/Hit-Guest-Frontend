import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Reservation } from "@/types"

/**
 * Con la tabla REAL (los demás tests de la lista la reemplazan por un mock que
 * hay que «pulsar»): así se ve el orden de efectos de React. La tabla avisa
 * sus filas visibles en su efecto, que corre ANTES que los del padre.
 */
const mocks = vi.hoisted(() => ({ list: vi.fn(), loadAutomationStatus: vi.fn() }))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { list: mocks.list, loadAutomationStatus: mocks.loadAutomationStatus, delete: vi.fn() },
    ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
}))
vi.mock("@/lib/bff-client", () => ({ bffFetch: () => new Promise(() => {}) }))
vi.mock("@/features/billing/services/consumption-service", () => ({ consumptionService: { getReservationCost: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@/lib/notify-error", () => ({ notifyError: vi.fn() }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/dashboard/reservations",
    useSearchParams: () => new URLSearchParams(),
}))

import { resetReservationsCache } from "../hooks/useReservations"
import { resetPropertiesCaches } from "@/features/properties/lib/properties-cache"
import ReservationsList from "./ReservationsList"

const ROWS = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`,
    guestName: `Huésped ${i}`,
    propertyName: "Casa Mar",
    unitName: "Suite",
    // Fechas distintas y descendentes: el orden por defecto deja r0..r9 visibles.
    checkIn: new Date(2026, 10, 30 - i),
    checkOut: new Date(2026, 10, 31 - i),
    status: "CONFIRMED",
    source: "Airbnb",
    sourceSlug: "airbnb",
})) as unknown as Reservation[]

const requestedIds = () => mocks.loadAutomationStatus.mock.calls.map(([r]) => (r as Reservation).id)

describe("Operaciones — volver con la lista en caché carga los semáforos sin recargar", () => {
    beforeEach(() => {
        resetReservationsCache()
        resetPropertiesCaches()
        vi.clearAllMocks()
        mocks.list.mockResolvedValue(ROWS)
        mocks.loadAutomationStatus.mockResolvedValue({ contract: "success" })
    })

    it("primera entrada (caché vacía): pide lo visible y la página siguiente", async () => {
        render(<ReservationsList />)
        await waitFor(() => expect(new Set(requestedIds()).size).toBe(20))
        expect(requestedIds().every((id) => Number(id.slice(1)) < 20)).toBe(true)
    })

    it("volver (caché caliente, la tabla aparece en el primer render): vuelve a pedirlos solo", async () => {
        const first = render(<ReservationsList />)
        await waitFor(() => expect(new Set(requestedIds()).size).toBe(20))
        first.unmount()
        mocks.loadAutomationStatus.mockClear()

        render(<ReservationsList />)
        // La lista ya está: se pinta sin esqueleto, en el primer render.
        expect(screen.getByText("Huésped 0")).toBeInTheDocument()
        await waitFor(() => expect(new Set(requestedIds()).size).toBe(20))
        expect(requestedIds().slice(0, 10).sort()).toEqual(ROWS.slice(0, 10).map((r) => r.id).sort())
    })

    it("en StrictMode (montar → limpiar → volver a montar) tampoco se pierde nada", async () => {
        const first = render(<ReservationsList />, { reactStrictMode: true })
        await waitFor(() => expect(new Set(requestedIds()).size).toBe(20))
        first.unmount()
        mocks.loadAutomationStatus.mockClear()

        render(<ReservationsList />, { reactStrictMode: true })
        await waitFor(() => expect(new Set(requestedIds()).size).toBe(20))
    })
})
