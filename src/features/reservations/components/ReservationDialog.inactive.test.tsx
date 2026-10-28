import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Radix Select usa APIs de puntero que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
// jsdom no trae ResizeObserver (lo usa un componente del formulario) ni matchMedia.
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.matchMedia = window.matchMedia ?? ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}) as MediaQueryList)

const mocks = vi.hoisted(() => ({
    properties: [] as unknown[],
    listings: [] as unknown[],
}))

vi.mock("@/features/properties/services/properties-service", () => ({
    propertiesService: { list: async () => mocks.properties },
}))
vi.mock("@/features/properties/services/listings-service", () => ({
    listingsService: { listByProperty: async () => mocks.listings, getById: async () => null },
}))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getReservationSources: async () => [{ id: 21, name: "Directo" }],
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

async function openSelect(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(await screen.findByRole("combobox", { name: label }))
}

describe("ReservationDialog — solo propiedades y alojamientos activos (pedido 2026-10-27)", () => {
    beforeEach(() => {
        mocks.properties = [
            { uuid: "p-on", name: "Casa Activa", statusRecord: { id: 6 } },
            { uuid: "p-off", name: "Casa Apagada", statusRecordId: 7 },
            { uuid: "p-?", name: "Casa Sin Estado" },
        ]
        mocks.listings = [
            { uuid: "l-on", name: "Apto Activo", propertyUuid: "p-on", statusRecord: { id: 6 } },
            { uuid: "l-off", name: "Apto Apagado", propertyUuid: "p-on", statusRecord: { id: 7 } },
        ]
    })

    it("dice la regla y muestra las inactivas deshabilitadas y marcadas", async () => {
        const user = await openDialog()
        expect(await screen.findByText("Solo puedes crear reservas en propiedades y alojamientos activos.")).toBeInTheDocument()

        await openSelect(user, "Propiedad *")
        expect(await screen.findByRole("option", { name: /Casa Activa/ })).not.toHaveAttribute("aria-disabled")
        expect(screen.getByRole("option", { name: /Casa Apagada · Inactiva/ })).toHaveAttribute("aria-disabled", "true")
        // Sin estado legible no se asume activa.
        expect(screen.getByRole("option", { name: /Casa Sin Estado · Estado sin confirmar/ })).toHaveAttribute("aria-disabled", "true")
    })

    it("alojamientos inactivos deshabilitados dentro de una propiedad activa", async () => {
        const user = await openDialog()
        await openSelect(user, "Propiedad *")
        await user.click(await screen.findByRole("option", { name: /Casa Activa/ }))

        await openSelect(user, "Alojamiento *")
        expect(await screen.findByRole("option", { name: /Apto Activo/ })).not.toHaveAttribute("aria-disabled")
        expect(screen.getByRole("option", { name: /Apto Apagado · Inactivo/ })).toHaveAttribute("aria-disabled", "true")
    })

    it("propiedad activa sin alojamientos activos: lo explica", async () => {
        mocks.listings = [{ uuid: "l-off", name: "Apto Apagado", propertyUuid: "p-on", statusRecord: { id: 7 } }]
        const user = await openDialog()
        await openSelect(user, "Propiedad *")
        await user.click(await screen.findByRole("option", { name: /Casa Activa/ }))

        expect(await screen.findByText("Esta propiedad no tiene alojamientos activos. Activa uno para poder crear la reserva.")).toBeInTheDocument()
    })

    it("sin ninguna propiedad activa: lo explica", async () => {
        mocks.properties = [{ uuid: "p-off", name: "Casa Apagada", statusRecordId: 7 }]
        await openDialog()
        expect(await screen.findByText(/No hay propiedades activas disponibles/)).toBeInTheDocument()
    })
})
