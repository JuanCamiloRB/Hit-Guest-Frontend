import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RegisterPriceDialog } from "./RegisterPriceDialog"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

const mocks = vi.hoisted(() => ({
    update: vi.fn(),
    listUsageRecords: vi.fn(),
    toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn(), info: vi.fn() } }))
vi.mock("../services/reservations-service", () => ({
    reservationsService: { update: mocks.update },
}))
vi.mock("@/features/properties/services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/features/properties/services/automation-service")>()
    return { ...actual, automationService: { listUsageRecords: mocks.listUsageRecords } }
})

// Historial (`/automation-records`): incluye ejecuciones de automatizaciones
// que hoy pueden estar desactivadas — por eso es la fuente, no `/automation-status`.
const traSent = [{ providerSlug: "tra_colombia", automationName: "TRA Colombia", status: "completed" }]
const traNotSent = [{ providerSlug: "tra_colombia", automationName: "TRA Colombia", status: "failed" }]

function renderDialog(props: Partial<React.ComponentProps<typeof RegisterPriceDialog>> = {}) {
    return render(
        <RegisterPriceDialog
            reservationUuid="res"
            currency="COP"
            open
            onClose={vi.fn()}
            onSaved={vi.fn()}
            {...props}
        />,
    )
}

describe("RegisterPriceDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.update.mockResolvedValue({})
        mocks.listUsageRecords.mockResolvedValue(traNotSent)
    })

    it("el PUT lleva únicamente { totalPrice }", async () => {
        renderDialog()
        fireEvent.change(screen.getByLabelText(/Valor total/), { target: { value: "540000" } })
        fireEvent.click(screen.getByRole("button", { name: "Registrar valor" }))
        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("res", { totalPrice: 540000 }))
        expect(mocks.listUsageRecords).not.toHaveBeenCalled()
    })

    it("rechaza más de dos decimales y sigue aceptando cero", async () => {
        renderDialog()
        const input = screen.getByLabelText(/Valor total/)
        fireEvent.change(input, { target: { value: "100.1234" } })
        expect(screen.getByText(/máximo dos decimales/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Registrar valor" })).toBeDisabled()

        fireEvent.change(input, { target: { value: "0" } })
        expect(screen.queryByText(/máximo dos decimales/)).toBeNull()
        expect(screen.getByRole("button", { name: "Registrar valor" })).toBeEnabled()
    })

    it("en corrección no deja guardar hasta saber si TRA ya se envió", async () => {
        let resolveStatus: (items: unknown[]) => void = () => {}
        mocks.listUsageRecords.mockReturnValue(new Promise((resolve) => { resolveStatus = resolve }))
        renderDialog({ mode: "correct", initialValue: 850000 })

        expect(screen.getByLabelText(/Valor total/)).toHaveValue(850000)
        expect(screen.getByText(/Comprobando si el reporte a TRA/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Guardar valor" })).toBeDisabled()

        resolveStatus(traSent)
        expect(await screen.findByText(/ya se envió con el valor anterior/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Guardar valor" })).toBeEnabled()

        fireEvent.click(screen.getByRole("button", { name: "Guardar valor" }))
        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("res", { totalPrice: 850000 }))
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Valor actualizado", {
            description: expect.stringContaining("conserva el valor anterior"),
        })
    })

    it("si no se pudo comprobar TRA, lo dice y nunca afirma que el valor nuevo se reportará", async () => {
        mocks.listUsageRecords.mockRejectedValue(new Error("network"))
        renderDialog({ mode: "correct", initialValue: 850000 })

        expect(await screen.findByText(/No pudimos comprobar si el reporte a TRA/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Guardar valor" }))
        await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
        const description = String(mocks.toastSuccess.mock.calls[0][1].description)
        expect(description).not.toContain("se usará")
        expect(description).toContain("Revisa")
    })

    it("sin moneda informada lo avisa en vez de mostrar COP", () => {
        renderDialog({ currency: null })
        expect(screen.getByText(/no informa su moneda/)).toBeInTheDocument()
        expect(screen.queryByText(/COP/)).toBeNull()
    })
})
