import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Radix Select usa APIs de puntero que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.matchMedia = window.matchMedia ?? ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}) as MediaQueryList)

const mocks = vi.hoisted(() => ({ getReservationSources: vi.fn() }))

vi.mock("@/features/properties/services/properties-service", () => ({ propertiesService: { list: async () => [] } }))
vi.mock("@/features/properties/services/listings-service", () => ({
    listingsService: { listByProperty: async () => [], getById: async () => null },
}))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getReservationSources: mocks.getReservationSources,
        getCountries: async () => [],
        getCurrencies: async () => [],
    },
}))
vi.mock("@/features/reservations/services/reservations-service", () => ({ reservationsService: {} }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { ReservationDialog } from "./ReservationDialog"

async function openDialog() {
    const user = userEvent.setup()
    render(<ReservationDialog />)
    await user.click(screen.getByRole("button", { name: /Nueva Reserva/ }))
    return user
}

const channelSelect = () => screen.findByRole("combobox", { name: /Canal de Reserva/ })
const createButton = () => screen.getByRole("button", { name: /Crear Reserva/ })

describe("ReservationDialog — canales: sin catálogo no se crea la reserva", () => {
    beforeEach(() => {
        mocks.getReservationSources.mockReset()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("catálogo correcto: ofrece los canales del backend y deja crear", async () => {
        mocks.getReservationSources.mockResolvedValue([{ id: "21", name: "Directo" }, { id: "22", name: "Airbnb" }])
        const user = await openDialog()
        await user.click(await channelSelect())
        expect(await screen.findByRole("option", { name: "Directo" })).toBeInTheDocument()
        expect(screen.getByRole("option", { name: "Airbnb" })).toBeInTheDocument()
        expect(screen.queryByRole("alert")).toBeNull()
        await user.keyboard("{Escape}")
        expect(createButton()).toBeEnabled()
    })

    it("catálogo fallido o vacío (el servicio lanza): avisa, bloquea crear y no inventa canales; Reintentar lo recupera", async () => {
        mocks.getReservationSources.mockRejectedValueOnce(new Error("No se pudo cargar el catálogo de canales de reserva"))
        const user = await openDialog()

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "No pudimos cargar los canales de reserva. Sin canal no se puede crear la reserva.",
        )
        expect(await channelSelect()).toBeDisabled()
        expect(createButton()).toBeDisabled()

        // Mientras reintenta, el aviso sigue (el foco no se pierde) y lo dice.
        let finish!: (value: unknown) => void
        mocks.getReservationSources.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
        const retry = screen.getByRole("button", { name: "Reintentar" })
        await user.click(retry)
        expect(retry).toHaveTextContent("Reintentando…")
        expect(retry).toHaveAttribute("aria-disabled", "true")
        expect(createButton()).toBeDisabled()

        finish([{ id: "21", name: "Directo" }])
        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
        expect(mocks.getReservationSources).toHaveBeenCalledTimes(2)
        const select = await channelSelect()
        expect(select).toBeEnabled()
        await waitFor(() => expect(select).toHaveFocus())
        expect(createButton()).toBeEnabled()
        // Solo el canal del backend: ninguno de los ids inventados de antes.
        await user.click(select)
        expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Directo"])
    })

    it("canales sin id numérico: cuenta como catálogo no disponible (nunca se envía NaN)", async () => {
        mocks.getReservationSources.mockResolvedValue([{ id: "0b6f-uuid", name: "Directo" }])
        await openDialog()
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los canales de reserva.")
        expect(createButton()).toBeDisabled()
    })
})
