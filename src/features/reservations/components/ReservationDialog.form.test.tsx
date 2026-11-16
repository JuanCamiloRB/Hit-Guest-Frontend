import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Radix Select, Popover y el calendario usan APIs de puntero que jsdom no implementa.
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

const mocks = vi.hoisted(() => ({
    properties: [{ uuid: "p-1", name: "Casa Mar", id: 1, statusRecord: { id: 6 } }] as unknown[],
    listProperties: vi.fn(),
    getCountries: vi.fn(),
    listings: [{ uuid: "l-1", id: 11, name: "Suite 101", propertyUuid: "p-1", statusRecord: { id: 6 } }] as unknown[],
    createWithFollowUp: vi.fn(),
    getById: vi.fn(),
    getRawById: vi.fn(),
    update: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock("@/features/properties/services/properties-service", () => ({
    propertiesService: { list: mocks.listProperties },
}))
vi.mock("@/features/properties/services/listings-service", () => ({
    listingsService: {
        listByProperty: async () => mocks.listings,
        getById: mocks.getById,
    },
}))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getReservationSources: async () => [{ id: "22", name: "Airbnb" }],
        // `PhoneInputField` lee `extra.phone_prefix` de cada país: el catálogo real siempre lo trae.
        getCountries: mocks.getCountries,
        getCurrencies: async () => [{ id: "COP", name: "COP - Peso colombiano" }, { id: "USD", name: "USD - Dólar" }],
    },
}))
vi.mock("@/features/reservations/services/reservations-service", () => ({
    reservationsService: { getRawById: mocks.getRawById, update: mocks.update },
}))
vi.mock("@/features/reservations/lib/create-reservation-followup", () => ({
    createReservationWithFollowUp: mocks.createWithFollowUp,
}))
vi.mock("sonner", () => ({ toast: mocks.toast }))

import { ReservationDialog } from "./ReservationDialog"

const COUNTRIES = [
    { id: 48, name: "Colombia", extra: { emoji: "🇨🇴", phone_prefix: "57" } },
    { id: 484, name: "México", extra: { emoji: "🇲🇽", phone_prefix: "52" } },
]

const LISTING_DETAIL = { uuid: "l-1", extra: { maxOccupancy: 4, startPrice: 650000, currency: "COP" } }

async function openCreate() {
    const user = userEvent.setup()
    render(<ReservationDialog />)
    await user.click(screen.getByRole("button", { name: /Nueva reserva/i }))
    await screen.findByRole("dialog")
    return user
}

type User = ReturnType<typeof userEvent.setup>

async function pickOption(user: User, comboboxName: RegExp | string, optionName: RegExp | string) {
    await user.click(await screen.findByRole("combobox", { name: comboboxName }))
    await user.click(await screen.findByRole("option", { name: optionName }))
}

/** Dos días del mes que muestra el calendario (el actual): llegada y salida. */
async function pickDates(user: User, from: string, to: string) {
    const trigger = screen.getByRole("button", { name: /Fechas de estancia/ })
    const day = async (text: string) => {
        if (screen.queryAllByRole("grid").length === 0) await user.click(trigger)
        const grid = (await screen.findAllByRole("grid"))[0]
        return within(grid).getAllByRole("button").find((b) => b.textContent?.trim() === text && !b.hasAttribute("disabled"))!
    }
    await user.click(await day(from))
    await user.click(await day(to))
    if (screen.queryAllByRole("grid").length > 0) await user.keyboard("{Escape}")
}

async function fillStay(user: User) {
    await pickOption(user, "Propiedad *", /Casa Mar/)
    await pickOption(user, "Alojamiento *", /Suite 101/)
    await pickOption(user, /Canal de reserva/, "Airbnb")
    await pickDates(user, "20", "23")
}

async function fillGuest(user: User) {
    await user.type(screen.getByLabelText(/^Nombres/), "María")
    await user.type(screen.getByLabelText(/^Apellidos/), "González")
    await pickOption(user, "Nacionalidad *", /Colombia/)
    await user.type(screen.getByLabelText(/Correo del huésped/), "maria@correo.com")
}

describe("ReservationDialog — crear (rediseño 2026-11-16)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0))
        mocks.getById.mockResolvedValue(LISTING_DETAIL)
        mocks.listProperties.mockImplementation(async () => mocks.properties)
        mocks.getCountries.mockResolvedValue(COUNTRIES)
        mocks.createWithFollowUp.mockResolvedValue({ tone: "success", title: "Reserva creada", description: "Link enviado.", reservationUuid: "res-9" })
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("el alojamiento sugiere huéspedes, precio y moneda; el resumen y el pie lo reflejan; el payload es el de siempre", async () => {
        const user = await openCreate()
        expect(screen.getByRole("combobox", { name: "Alojamiento *" })).toBeDisabled()
        expect(screen.getByText("Completa la estancia para ver el resumen.")).toBeInTheDocument()

        await fillStay(user)
        // Precarga: capacidad y precio del alojamiento, marcados como sugeridos.
        await waitFor(() => expect(screen.getByLabelText(/Precio total/)).toHaveValue("650000"))
        expect(screen.getByLabelText(/^Huéspedes/)).toHaveValue("4")
        expect(screen.getByText("Capacidad: 4")).toBeInTheDocument()
        expect(screen.getByText(/Sugerido por el alojamiento/)).toBeInTheDocument()
        // Resumen: alojamiento, noches y precio por noche.
        const summary = screen.getByRole("complementary", { name: "Resumen" })
        expect(summary).toHaveTextContent("Suite 101")
        expect(summary).toHaveTextContent("3 noches")
        expect(summary).toHaveTextContent("por noche")

        await fillGuest(user)
        // El PM corrige el precio: deja de ser «sugerido».
        const price = screen.getByLabelText(/Precio total/)
        await user.clear(price)
        await user.type(price, "500000")
        expect(screen.queryByText(/Sugerido por el alojamiento/)).toBeNull()

        await user.click(screen.getByRole("button", { name: "Crear y enviar link" }))
        await waitFor(() => expect(mocks.createWithFollowUp).toHaveBeenCalledTimes(1))
        const call = mocks.createWithFollowUp.mock.calls[0][0]
        expect(call.sendLinkNow).toBe(true)
        expect(call.email).toBe("maria@correo.com")
        expect(call.payload).toMatchObject({
            listingUuid: "l-1", listing_uuid: "l-1", listingId: "l-1", listing_id: "l-1",
            reservationSourceId: 22, arrivalDate: "2026-11-20", departureDate: "2026-11-23",
            emailGuest: "maria@correo.com", totalGuests: 4, currency: "COP", totalPrice: 500000,
            extra: { guest_name: "María", guest_lastname: "González", guest_country: "Colombia", guest_country_id: 48, guest_phone: null },
            statusReservationId: 27,
        })
        expect(call.payload.externalId).toMatch(/^MANUAL-/)
        expect("propertyUuid" in call.payload).toBe(false)
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    })

    it("lo que el PM ya escribió no lo pisa la precarga del alojamiento", async () => {
        const user = await openCreate()
        const price = screen.getByLabelText(/Precio total/)
        await user.type(price, "123")
        await pickOption(user, "Propiedad *", /Casa Mar/)
        await pickOption(user, "Alojamiento *", /Suite 101/)
        await waitFor(() => expect(screen.getByLabelText(/^Huéspedes/)).toHaveValue("4"))
        expect(price).toHaveValue("123")
        expect(screen.queryByText(/Sugerido por el alojamiento/)).toBeNull()
    })

    it("cambiar rápido de alojamiento: la sugerencia tardía del anterior no pisa la del vigente", async () => {
        mocks.listings = [
            { uuid: "l-1", id: 11, name: "Suite 101", propertyUuid: "p-1", statusRecord: { id: 6 } },
            { uuid: "l-2", id: 12, name: "Suite 102", propertyUuid: "p-1", statusRecord: { id: 6 } },
        ]
        let resolveSlow!: (value: unknown) => void
        mocks.getById.mockImplementation((uuid: string) => uuid === "l-1"
            ? new Promise((resolve) => { resolveSlow = resolve })
            : Promise.resolve({ uuid: "l-2", extra: { maxOccupancy: 2, startPrice: 99, currency: "USD" } }))
        const user = await openCreate()
        await pickOption(user, "Propiedad *", /Casa Mar/)
        await pickOption(user, "Alojamiento *", /Suite 101/)
        await pickOption(user, "Alojamiento *", /Suite 102/)
        await waitFor(() => expect(screen.getByLabelText(/Precio total/)).toHaveValue("99"))

        // Llega tarde la respuesta del anterior: no escribe.
        resolveSlow(LISTING_DETAIL)
        await new Promise((done) => setTimeout(done, 0))
        expect(screen.getByLabelText(/Precio total/)).toHaveValue("99")
        expect(screen.getByLabelText(/^Huéspedes/)).toHaveValue("2")
        mocks.listings = [{ uuid: "l-1", id: 11, name: "Suite 101", propertyUuid: "p-1", statusRecord: { id: 6 } }]
    })

    it("cambiar de propiedad con la sugerencia en vuelo: no escribe, y el precio solo sugerido se vacía", async () => {
        mocks.properties = [
            { uuid: "p-1", name: "Casa Mar", id: 1, statusRecord: { id: 6 } },
            { uuid: "p-2", name: "Casa Sol", id: 2, statusRecord: { id: 6 } },
        ]
        mocks.listings = [
            { uuid: "l-1", id: 11, name: "Suite 101", propertyUuid: "p-1", statusRecord: { id: 6 } },
            { uuid: "l-2", id: 12, name: "Suite 102", propertyUuid: "p-1", statusRecord: { id: 6 } },
        ]
        const user = await openCreate()
        // Primero un alojamiento con su sugerencia ya aplicada.
        await pickOption(user, "Propiedad *", /Casa Mar/)
        await pickOption(user, "Alojamiento *", /Suite 101/)
        await waitFor(() => expect(screen.getByLabelText(/Precio total/)).toHaveValue("650000"))

        // Otro alojamiento cuya sugerencia tarda; antes de que llegue, se cambia de propiedad.
        let resolveSlow!: (value: unknown) => void
        mocks.getById.mockImplementation(() => new Promise((resolve) => { resolveSlow = resolve }))
        await pickOption(user, "Alojamiento *", /Suite 102/)
        await pickOption(user, "Propiedad *", /Casa Sol/)
        expect(screen.getByLabelText(/Precio total/)).toHaveValue("")
        expect(screen.queryByText(/Capacidad:/)).toBeNull()

        resolveSlow({ uuid: "l-1", extra: { maxOccupancy: 6, startPrice: 900, currency: "USD" } })
        await new Promise((done) => setTimeout(done, 0))
        expect(screen.getByLabelText(/Precio total/)).toHaveValue("")
        expect(screen.queryByText(/Capacidad:/)).toBeNull()
        expect(screen.queryByText(/Sugerido por el alojamiento/)).toBeNull()
        mocks.properties = [{ uuid: "p-1", name: "Casa Mar", id: 1, statusRecord: { id: 6 } }]
        mocks.listings = [{ uuid: "l-1", id: 11, name: "Suite 101", propertyUuid: "p-1", statusRecord: { id: 6 } }]
    })

    it("el aviso de faltantes baja al corregir, sin otro envío", async () => {
        const user = await openCreate()
        await user.click(screen.getByRole("button", { name: "Crear y enviar link" }))
        const first = (await screen.findByRole("alert")).textContent ?? ""
        const before = Number(first.match(/Faltan (\d+)/)?.[1])
        await user.type(screen.getByLabelText(/^Nombres/), "María")
        await waitFor(() => {
            const now = Number(screen.getByRole("alert").textContent?.match(/Faltan (\d+)/)?.[1])
            expect(now).toBe(before - 1)
        })
    })

    it("422 de recurso inactivo: el error queda en el alojamiento, se avisa con «Gestionar» y se releen los estados", async () => {
        mocks.createWithFollowUp.mockRejectedValueOnce(Object.assign(new Error("El alojamiento está inactivo."), { status: 422, code: "LISTING_INACTIVE" }))
        const user = await openCreate()
        await fillStay(user)
        await fillGuest(user)
        await user.click(screen.getByRole("button", { name: "Crear y enviar link" }))
        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledTimes(1))
        const [title, options] = mocks.toast.error.mock.calls[0]
        expect(title).toBe("No se pudo crear la reserva")
        expect(options).toMatchObject({ description: "El alojamiento está inactivo.", action: { label: "Gestionar alojamiento" } })
        // El diálogo sigue abierto con el borrador y el mensaje junto al campo y arriba.
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getAllByText("El alojamiento está inactivo.").length).toBeGreaterThanOrEqual(2)
        expect(screen.getByLabelText(/^Nombres/)).toHaveValue("María")
    })

    it("propiedades o países que no cargan: se dice junto al campo y «Reintentar» los recupera", async () => {
        mocks.listProperties.mockRejectedValueOnce(new Error("500"))
        mocks.getCountries.mockRejectedValueOnce(new Error("500"))
        const user = await openCreate()
        expect(await screen.findByText(/No pudimos cargar las propiedades\. Sin propiedad no se puede crear la reserva\./)).toBeInTheDocument()
        expect(screen.getByText(/No pudimos cargar los países\. La nacionalidad es obligatoria\./)).toBeInTheDocument()

        const retries = screen.getAllByRole("button", { name: "Reintentar" })
        for (const retry of retries) await user.click(retry)
        await waitFor(() => expect(screen.queryByText(/No pudimos cargar/)).toBeNull())
        await pickOption(user, "Propiedad *", /Casa Mar/)
        await pickOption(user, "Nacionalidad *", /Colombia/)
    })

    it("propiedad activa sin alojamientos activos: el aviso lleva a gestionar los alojamientos", async () => {
        mocks.listings = [{ uuid: "l-off", id: 13, name: "Apto Apagado", propertyUuid: "p-1", statusRecord: { id: 7 } }]
        const user = await openCreate()
        await pickOption(user, "Propiedad *", /Casa Mar/)
        expect(await screen.findByRole("link", { name: "Gestionar alojamientos" })).toHaveAttribute("href", "/dashboard/properties/p-1?tab=units")
        mocks.listings = [{ uuid: "l-1", id: 11, name: "Suite 101", propertyUuid: "p-1", statusRecord: { id: 6 } }]
    })

    it("creada pero el link falló: aviso con «Ver reserva» hacia su ficha", async () => {
        mocks.createWithFollowUp.mockResolvedValueOnce({ tone: "warning", title: "Reserva creada, pero el link no se envió", description: "Mailgun no respondió.", reservationUuid: "res-9" })
        const user = await openCreate()
        await fillStay(user)
        await fillGuest(user)
        await user.click(screen.getByRole("button", { name: "Crear y enviar link" }))
        await waitFor(() => expect(mocks.toast.warning).toHaveBeenCalledTimes(1))
        const [title, options] = mocks.toast.warning.mock.calls[0]
        expect(title).toBe("Reserva creada, pero el link no se envió")
        expect(options.action.label).toBe("Ver reserva")
        const assign = vi.fn()
        vi.stubGlobal("location", { ...window.location, assign })
        try {
            options.action.onClick()
            expect(assign).toHaveBeenCalledWith("/dashboard/reservations/res-9")
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it("una moneda que el catálogo no trae (la del alojamiento) se ofrece igual, no queda «—»", async () => {
        mocks.getById.mockResolvedValue({ uuid: "l-1", extra: { maxOccupancy: 2, startPrice: 80, currency: "EUR" } })
        const user = await openCreate()
        await pickOption(user, "Propiedad *", /Casa Mar/)
        await pickOption(user, "Alojamiento *", /Suite 101/)
        await waitFor(() => expect(screen.getByRole("combobox", { name: "Moneda" })).toHaveTextContent("EUR"))
    })

    it("con el envío apagado la acción dice «Crear reserva» y no se pide el link; vacío = requerido, 0 = «Sin costo»", async () => {
        const user = await openCreate()
        await user.click(screen.getByRole("switch", { name: /Enviar link después de crear/ }))
        expect(screen.getByRole("button", { name: "Crear reserva" })).toBeInTheDocument()
        expect(screen.getByText("Podrás enviarlo después desde la ficha de la reserva.")).toBeInTheDocument()

        await fillStay(user)
        await fillGuest(user)
        const price = screen.getByLabelText(/Precio total/)
        await user.clear(price)
        await user.click(screen.getByRole("button", { name: "Crear reserva" }))
        expect(await screen.findByText("Escribe el precio total (0 si no tiene costo)")).toBeInTheDocument()
        expect(mocks.createWithFollowUp).not.toHaveBeenCalled()

        await user.type(price, "0")
        // En el campo (insignia) y en el resumen (total).
        expect(screen.getAllByText("Sin costo").length).toBeGreaterThan(0)
        await user.click(screen.getByRole("button", { name: "Crear reserva" }))
        await waitFor(() => expect(mocks.createWithFollowUp).toHaveBeenCalledTimes(1))
        expect(mocks.createWithFollowUp.mock.calls[0][0]).toMatchObject({ sendLinkNow: false, payload: { totalPrice: 0 } })
    })

    it("enviar con todo vacío: un aviso con la cuenta, los errores junto a sus campos y el foco en el primero", async () => {
        const user = await openCreate()
        await user.click(screen.getByRole("button", { name: "Crear y enviar link" }))
        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent(/Faltan \d+ campos\. Los marcamos abajo\./)
        expect(screen.getByText("Selecciona una propiedad")).toBeInTheDocument()
        expect(screen.getByText("Selecciona las fechas de llegada y salida")).toBeInTheDocument()
        expect(screen.getByText("Escribe el precio total (0 si no tiene costo)")).toBeInTheDocument()
        expect(mocks.createWithFollowUp).not.toHaveBeenCalled()
        await waitFor(() => expect(screen.getByRole("combobox", { name: "Propiedad *" })).toHaveFocus())
    })

    it("cancelar con cambios pide confirmación; «Seguir editando» conserva, «Descartar» cierra", async () => {
        const user = await openCreate()
        await user.type(screen.getByLabelText(/^Nombres/), "Ma")
        await user.click(screen.getByRole("button", { name: "Cancelar" }))
        const confirm = await screen.findByRole("alertdialog", { name: "¿Descartar la reserva?" })
        await user.click(within(confirm).getByRole("button", { name: "Seguir editando" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(screen.getByLabelText(/^Nombres/)).toHaveValue("Ma")

        await user.click(screen.getByRole("button", { name: "Cancelar" }))
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Descartar" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    })

    it("sin cambios, cancelar cierra sin preguntar; el teléfono es opcional", async () => {
        const user = await openCreate()
        expect(screen.getByText(/opcional/)).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Cancelar" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(screen.queryByRole("alertdialog")).toBeNull()
    })
})

describe("ReservationDialog — editar", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getById.mockResolvedValue(LISTING_DETAIL)
        mocks.listProperties.mockImplementation(async () => mocks.properties)
        mocks.getCountries.mockResolvedValue(COUNTRIES)
        mocks.getRawById.mockResolvedValue({
            uuid: "r-1", arrivalDate: "2026-12-01", departureDate: "2026-12-03",
            listing: { uuid: "l-1", property: { uuid: "p-1" } },
            source: { id: 22, name: "Airbnb", slug: "airbnb" },
            extra: { guestName: "Ada", guestLastname: "Lovelace", guestCountry: "Colombia", guestPhone: "+57 300 123 4567" },
            emailGuest: "ada@example.com", totalGuests: 2, totalPrice: 100, currency: "COP",
        })
        mocks.update.mockResolvedValue({})
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("mientras carga la reserva, la forma de los campos (no un formulario vacío)", async () => {
        let resolveLoad!: (value: unknown) => void
        mocks.getRawById.mockReturnValueOnce(new Promise((resolve) => { resolveLoad = resolve }))
        const user = userEvent.setup()
        render(<ReservationDialog mode="edit" reservationUuid="r-1" trigger={<button type="button">Editar</button>} />)
        await user.click(screen.getByRole("button", { name: "Editar" }))
        expect(await screen.findByRole("status", { name: "Cargando la reserva" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled()
        resolveLoad({ uuid: "r-1", arrivalDate: "2026-12-01", departureDate: "2026-12-03", listing: { uuid: "l-1", property: { uuid: "p-1" } }, source: { id: 22 }, extra: {}, emailGuest: "ada@example.com", totalGuests: 2, totalPrice: 100, currency: "COP" })
        await waitFor(() => expect(screen.queryByRole("status", { name: "Cargando la reserva" })).toBeNull())
        expect(screen.getByDisplayValue("ada@example.com")).toBeInTheDocument()
    })

    it("mismos campos que crear, el interruptor de envío deshabilitado; «Guardar cambios» manda el payload sin código ni estado", async () => {
        const user = userEvent.setup()
        render(<ReservationDialog mode="edit" reservationUuid="r-1" trigger={<button type="button">Editar</button>} />)
        await user.click(screen.getByRole("button", { name: "Editar" }))
        expect(await screen.findByRole("dialog", { name: "Editar reserva" })).toBeInTheDocument()
        expect(await screen.findByDisplayValue("ada@example.com")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Ada")).toBeInTheDocument()
        expect(screen.getByLabelText(/Precio total/)).toHaveValue("100")
        expect(screen.getByLabelText(/^Huéspedes/)).toHaveValue("2")
        expect(screen.getByRole("combobox", { name: "Nacionalidad *" })).toHaveTextContent("Colombia")
        // El campo sigue a la vista (no se quita ninguno), deshabilitado y con la razón.
        const sendSwitch = screen.getByRole("switch", { name: /Enviar link después de guardar/ })
        expect(sendSwitch).toBeDisabled()
        expect(sendSwitch).not.toBeChecked()
        expect(screen.getByText(/Guardar cambios no vuelve a enviar el link/)).toBeInTheDocument()
        // Lo que ya tiene la reserva no lo pisa el alojamiento.
        expect(screen.queryByText(/Sugerido por el alojamiento/)).toBeNull()

        const save = screen.getByRole("button", { name: "Guardar cambios" })
        await waitFor(() => expect(save).toBeEnabled())
        await user.click(save)
        await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
        const [uuid, payload] = mocks.update.mock.calls[0]
        expect(uuid).toBe("r-1")
        expect(payload).toMatchObject({ listingUuid: "l-1", reservationSourceId: 22, totalPrice: 100, totalGuests: 2, extra: { guest_phone: "+57 300 123 4567" } })
        expect("externalId" in payload).toBe(false)
        expect("statusReservationId" in payload).toBe(false)
        expect(mocks.createWithFollowUp).not.toHaveBeenCalled()
    })
})
