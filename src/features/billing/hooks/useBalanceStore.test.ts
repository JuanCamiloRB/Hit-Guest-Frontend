import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getBalance: vi.fn() }))
vi.mock("../services/billing-service", () => ({ billingService: { getBalance: mocks.getBalance } }))

import { useBalanceStore } from "./useBalanceStore"

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

describe("useBalanceStore — una sola fuente de saldo", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useBalanceStore.setState({ amount: null, currency: "USD", pending: false, isLoading: false, loaded: false, error: false })
    })

    it("un fallo sin saldo previo deja el saldo desconocido (null), nunca 0", async () => {
        mocks.getBalance.mockRejectedValue(new Error("network down"))
        await useBalanceStore.getState().refresh()
        expect(useBalanceStore.getState()).toMatchObject({ amount: null, error: true, loaded: true })
    })

    it("un fallo con saldo previo lo conserva y lo marca como no actualizado", async () => {
        mocks.getBalance.mockResolvedValueOnce({ amount: 6.49, currency: "USD" })
        await useBalanceStore.getState().refresh()
        mocks.getBalance.mockRejectedValueOnce(new Error("network down"))
        await useBalanceStore.getState().refresh()
        expect(useBalanceStore.getState()).toMatchObject({ amount: 6.49, error: true })

        mocks.getBalance.mockResolvedValueOnce({ amount: 5, currency: "USD" })
        await useBalanceStore.getState().refresh()
        expect(useBalanceStore.getState()).toMatchObject({ amount: 5, error: false })
    })

    it("carrera: la respuesta de una consulta anterior no pisa la más reciente", async () => {
        const older = deferred<{ amount: number; currency: string }>()
        const newer = deferred<{ amount: number; currency: string }>()
        mocks.getBalance.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)

        const first = useBalanceStore.getState().load()
        const second = useBalanceStore.getState().refresh()
        newer.resolve({ amount: 8, currency: "USD" })
        await second
        older.resolve({ amount: 3, currency: "USD" })
        await first

        expect(useBalanceStore.getState().amount).toBe(8)
    })
})
