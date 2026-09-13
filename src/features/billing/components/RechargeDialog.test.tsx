import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RechargeDialog } from "./RechargeDialog"

const mocks = vi.hoisted(() => ({
    getPackages: vi.fn(),
    createRecharge: vi.fn(),
}))

vi.mock("../services/billing-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/billing-service")>()),
    billingService: {
        getPackages: mocks.getPackages,
        createRecharge: mocks.createRecharge,
    },
}))

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => { resolve = res })
    return { promise, resolve }
}

describe("RechargeDialog — paquetes definidos por backend", () => {
    beforeEach(() => vi.clearAllMocks())

    it("no muestra ni permite enviar presets ficticios mientras carga", async () => {
        const pending = deferred<{
            packages: Array<{ amount: number; label?: string }>
            minimumCustom: number
            currency: string
        }>()
        mocks.getPackages.mockReturnValue(pending.promise)
        render(<RechargeDialog />)

        fireEvent.click(screen.getByRole("button", { name: /Recargar/ }))
        expect(screen.getByRole("status")).toHaveTextContent(/Cargando montos/)
        expect(screen.queryByRole("button", { name: "$20" })).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Continuar al pago" })).toBeDisabled()

        pending.resolve({
            packages: [{ amount: 10 }, { amount: 25 }, { amount: 50 }, { amount: 100 }],
            minimumCustom: 10,
            currency: "USD",
        })

        expect(await screen.findByRole("button", { name: "$10" })).toBeInTheDocument()
        expect(screen.getByRole("spinbutton")).toHaveValue(10)
        expect(screen.getByRole("button", { name: "Continuar al pago" })).toBeEnabled()
    })
})
