import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/api-client", () => ({
    apiClient: { get: mocks.get, post: vi.fn() },
}))

import { billingService } from "./billing-service"

describe("billingService.getBalance", () => {
    beforeEach(() => vi.clearAllMocks())

    it("acepta un saldo numérico real, incluido cero", async () => {
        mocks.get.mockResolvedValue({ data: { balance: 0, currency: "USD" } })
        await expect(billingService.getBalance()).resolves.toEqual({ amount: 0, currency: "USD" })
    })

    it("normaliza un saldo numérico enviado como string", async () => {
        mocks.get.mockResolvedValue({ balance: "10.50", currency: "USD" })
        await expect(billingService.getBalance()).resolves.toEqual({ amount: 10.5, currency: "USD" })
    })

    it("rechaza una respuesta sin saldo en vez de inventar 0 USD", async () => {
        mocks.get.mockResolvedValue({ data: {} })
        await expect(billingService.getBalance()).rejects.toThrow("no contiene un monto válido")
    })

    it("rechaza un saldo no numérico", async () => {
        mocks.get.mockResolvedValue({ balance: "abc" })
        await expect(billingService.getBalance()).rejects.toThrow("no contiene un monto válido")
    })
})
