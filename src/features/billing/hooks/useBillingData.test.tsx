import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    getReservationCosts: vi.fn(),
    getBalance: vi.fn(),
}))

vi.mock("@/features/reservations/services/reservations-service", () => ({
    reservationsService: { list: mocks.list },
}))
vi.mock("../services/consumption-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/consumption-service")>()),
    consumptionService: {
        getReservationCosts: mocks.getReservationCosts,
        analyze: () => ({ summary: null, monthly: [], topNodes: [] }),
    },
}))
vi.mock("../services/billing-service", () => ({
    billingService: { getBalance: mocks.getBalance },
}))

describe("useBillingData — el Tablero se entera de una reserva nueva", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.list.mockResolvedValue([])
        mocks.getReservationCosts.mockResolvedValue([])
        mocks.getBalance.mockResolvedValue({ amount: 6.49, currency: "USD" })
    })

    it("vuelve a cargar los costos cuando se crea una reserva desde el encabezado", async () => {
        const { useBillingData } = await import("./useBillingData")
        const { result } = renderHook(() => useBillingData())
        await waitFor(() => expect(result.current.isLoadingCosts).toBe(false))
        expect(mocks.list).toHaveBeenCalledTimes(1)

        act(() => { window.dispatchEvent(new Event("reservationCreated")) })

        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(result.current.isLoadingCosts).toBe(false))
    })
})
