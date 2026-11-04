import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    getBalance: vi.fn(),
    getPackages: vi.fn(),
}))

vi.mock("../services/billing-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/billing-service")>()
    return {
        ...actual,
        billingService: { getBalance: mocks.getBalance, getPackages: mocks.getPackages },
    }
})
vi.mock("./TransactionHistory", () => ({ TransactionHistory: () => null }))

import { useBalanceStore } from "../hooks/useBalanceStore"
import { BillingSettings } from "./BillingSettings"

describe("BillingSettings — el saldo nunca se inventa", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getPackages.mockResolvedValue(null)
        useBalanceStore.setState({ amount: null, currency: "USD", pending: false, isLoading: false, loaded: false, error: false })
    })

    it("si el saldo no se pudo consultar, dice «no disponible» en vez de 0,00 USD en rojo", async () => {
        mocks.getBalance.mockRejectedValue(new Error("500"))
        render(<BillingSettings />)

        await waitFor(() => expect(screen.getByText("— USD")).toBeInTheDocument())
        expect(screen.getByText(/Saldo no disponible/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
        expect(screen.queryByText("0,00 USD")).toBeNull()
    })

    it("antes de la primera consulta muestra el esqueleto, no «no disponible»", () => {
        mocks.getBalance.mockReturnValue(new Promise(() => {}))
        render(<BillingSettings />)
        expect(screen.queryByText(/Saldo no disponible/)).toBeNull()
        expect(screen.queryByText("— USD")).toBeNull()
    })

    it("con un saldo anterior y una actualización fallida, lo conserva y avisa", async () => {
        useBalanceStore.setState({ amount: 10, loaded: true })
        mocks.getBalance.mockRejectedValue(new Error("500"))
        render(<BillingSettings />)

        await waitFor(() => expect(screen.getByText("No se pudo actualizar el saldo")).toBeInTheDocument())
        expect(screen.getByText("10,00 USD")).toBeInTheDocument()
    })
})
