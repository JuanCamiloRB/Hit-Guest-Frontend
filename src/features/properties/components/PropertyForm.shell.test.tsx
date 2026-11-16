import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }
window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 }

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    searchParams: new URLSearchParams(),
    getPropertyTypes: vi.fn(),
    getStatusRecords: vi.fn(),
    getAmenities: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toastSuccess: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
    useSearchParams: () => mocks.searchParams,
}))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getPropertyTypes: mocks.getPropertyTypes,
        getStatusRecords: mocks.getStatusRecords,
        getAmenities: mocks.getAmenities,
        getPmsSources: async () => [],
    },
}))
vi.mock("../services/properties-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/properties-service")>()
    return { ...actual, propertiesService: { create: mocks.create, update: mocks.update, delete: mocks.remove } }
})
vi.mock("../services/listings-service", () => ({ listingsService: { create: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
// Las pestañas pesadas (mapa, alojamientos, automatizaciones, documentos) se
// prueban aparte: aquí importa el cascarón del formulario.
vi.mock("./PropertiesLocation", () => ({ PropertiesLocation: () => <div data-testid="tab-location">ubicación</div> }))
vi.mock("./PropertiesUnits", () => ({ PropertiesUnits: () => <div data-testid="tab-units">alojamientos</div> }))
vi.mock("./PropertiesPhotos", () => ({ PropertiesPhotos: () => <div data-testid="tab-photos">fotos</div> }))
vi.mock("./PropertiesAutomation", () => ({ PropertiesAutomation: () => <div data-testid="tab-automations">automatización</div> }))
vi.mock("./documents", () => ({ PropertiesDocuments: () => <div data-testid="tab-documents">documentos</div> }))

import { PropertyForm } from "./PropertyForm"
import { DEFAULT_PROPERTY_THUMBNAIL_URL } from "../lib/property-defaults"

const UUID = "6f1c2a3e-9b4d-4c1e-8f2a-1a2b3c4d5e6f"

const existing = {
    uuid: UUID, name: "Edificio Mirador", email: "contacto@mirador.co", phone: "+57 300 123 4567",
    address: "Carrera 1 # 2-3", addressDetail: "", city: "Cartagena", state: "Bolívar", countryId: 48,
    latitude: 10.4, longitude: -75.5, statusRecordId: 6, propertyTypeId: 102,
    thumbnailUrl: "https://cdn.example/portada.jpg", communicationsLocale: "es", amenities: [], picturesUrl: [],
    units: [], externalPmsIds: [], statusRecord: { id: 6 },
}

function tabNames() {
    return screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())
}

describe("PropertyForm — cascarón: pestañas, errores por pestaña, barra de acciones, catálogos, zona de peligro", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.searchParams = new URLSearchParams()
        mocks.getPropertyTypes.mockResolvedValue([{ id: 102, name: "Hotel" }])
        mocks.getStatusRecords.mockResolvedValue([{ id: 6, name: "Activo" }, { id: 7, name: "Inactivo" }])
        mocks.getAmenities.mockResolvedValue([])
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("al crear: cuatro pestañas en el orden del trabajo, sin Automatización ni Documentos", async () => {
        render(<PropertyForm />)
        expect(tabNames()).toEqual(["Detalles", "Ubicación", "Alojamientos", "Fotos"])
        expect(screen.getByRole("button", { name: "Crear propiedad" })).toBeInTheDocument()
        // La barra se ve desde el inicio: aquí todo son campos obligatorios por llenar.
        expect(screen.getByRole("region", { name: "Acciones del formulario" })).toHaveTextContent("Campos obligatorios")
        await screen.findByRole("option", { name: "Hotel" }, { timeout: 50 }).catch(() => undefined)
    })

    it("al editar: seis pestañas; la barra solo existe con cambios pendientes, en cualquier pestaña", async () => {
        const user = userEvent.setup()
        render(<PropertyForm initialData={existing} />)
        expect(tabNames()).toEqual(["Detalles", "Ubicación", "Alojamientos", "Fotos", "Automatización", "Documentos"])
        // Sin cambios no hay barra: ni en Detalles ni en las que se guardan solas.
        expect(screen.queryByRole("region", { name: "Acciones del formulario" })).toBeNull()
        await user.click(screen.getByRole("tab", { name: "Automatización" }))
        expect(screen.queryByRole("region", { name: "Acciones del formulario" })).toBeNull()

        await user.click(screen.getByRole("tab", { name: "Detalles" }))
        await user.type(screen.getByLabelText(/Nombre de la propiedad/), " Norte")
        expect(screen.getByRole("region", { name: "Acciones del formulario" })).toHaveTextContent("Cambios sin guardar")
        await user.click(screen.getByRole("tab", { name: "Automatización" }))
        const bar = screen.getByRole("region", { name: "Acciones del formulario" })
        expect(bar).toHaveTextContent("Cambios sin guardar")
        expect(within(bar).getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument()
    })

    it("`?tab=` solo entre las pestañas de este modo: `automations` al crear no abre nada", () => {
        mocks.searchParams = new URLSearchParams("tab=automations")
        render(<PropertyForm />)
        expect(screen.getByRole("tab", { name: "Detalles" })).toHaveAttribute("aria-selected", "true")
    })

    it("`?tab=photos` abre Fotos", () => {
        mocks.searchParams = new URLSearchParams("tab=photos")
        render(<PropertyForm initialData={existing} />)
        expect(screen.getByRole("tab", { name: "Fotos" })).toHaveAttribute("aria-selected", "true")
    })

    it("enviar vacío: aviso con el conteo por pestaña, contador accesible en cada pestaña y salto a la primera con error", async () => {
        const user = userEvent.setup()
        render(<PropertyForm />)
        await screen.findByRole("combobox", { name: /Tipo de propiedad/ })
        await user.click(screen.getByRole("button", { name: "Crear propiedad" }))

        const banner = await screen.findByRole("alert")
        // name, email, propertyTypeId → Detalles (3); address, city, state, countryId → Ubicación (4)
        expect(banner).toHaveTextContent("Faltan 7 campos")
        expect(within(banner).getByRole("button", { name: "Detalles (3)" })).toBeInTheDocument()
        expect(within(banner).getByRole("button", { name: "Ubicación (4)" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Detalles, 3 errores" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Ubicación, 4 errores" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Detalles, 3 errores" })).toHaveAttribute("aria-selected", "true")
        expect(screen.getByLabelText(/Nombre de la propiedad/)).toHaveFocus()
        expect(mocks.create).not.toHaveBeenCalled()

        // El botón del aviso cambia de pestaña.
        await user.click(within(banner).getByRole("button", { name: "Ubicación (4)" }))
        expect(screen.getByRole("tab", { name: "Ubicación, 4 errores" })).toHaveAttribute("aria-selected", "true")

        // Corregir un campo baja el conteo en vivo, sin otro envío.
        await user.click(screen.getByRole("tab", { name: "Detalles, 3 errores" }))
        await user.type(screen.getByLabelText(/Nombre de la propiedad/), "Edificio Mirador")
        await waitFor(() => expect(screen.getByRole("tab", { name: "Detalles, 2 errores" })).toBeInTheDocument())
        expect(screen.getByRole("alert")).toHaveTextContent("Faltan 6 campos")
    })

    it("un envío inválido desde Fotos salta a Detalles y enfoca el primer campo (los errores llegan en `onInvalid`, no en el render anterior)", async () => {
        const user = userEvent.setup()
        render(<PropertyForm />)
        await screen.findByRole("combobox", { name: /Tipo de propiedad/ })
        await user.click(screen.getByRole("tab", { name: "Fotos" }))
        await user.click(screen.getByRole("button", { name: "Crear propiedad" }))
        await screen.findByRole("alert")
        expect(screen.getByRole("tab", { name: "Detalles, 3 errores" })).toHaveAttribute("aria-selected", "true")
        await waitFor(() => expect(screen.getByLabelText(/Nombre de la propiedad/)).toHaveFocus())
    })

    it("la validación nativa no se interpone: una portada sin esquema pasa a zod y al aviso, no a la burbuja del navegador", async () => {
        const user = userEvent.setup()
        render(<PropertyForm />)
        expect(document.querySelector("form")).toHaveAttribute("novalidate")
        const portada = screen.getByLabelText("Portada")
        await user.clear(portada)
        await user.type(portada, "cdn.example/portada.jpg")
        await user.click(screen.getByRole("button", { name: "Crear propiedad" }))
        // zod acepta la portada (string opcional): el aviso cuenta los 7 de siempre, nada más.
        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan 7 campos")
    })

    it("catálogo de tipos caído: aviso junto al campo con «Reintentar», y el selector queda deshabilitado", async () => {
        const user = userEvent.setup()
        mocks.getPropertyTypes.mockRejectedValueOnce(new Error("500"))
        render(<PropertyForm />)
        const alert = await screen.findByText(/No pudimos cargar los tipos de propiedad/)
        expect(alert).toHaveTextContent("Sin tipo no se puede guardar.")
        expect(screen.getByRole("combobox", { name: /Tipo de propiedad/ })).toBeDisabled()

        mocks.getPropertyTypes.mockResolvedValueOnce([{ id: 102, name: "Hotel" }])
        await user.click(screen.getByRole("button", { name: "Reintentar" }))
        await waitFor(() => expect(screen.queryByText(/No pudimos cargar los tipos de propiedad/)).toBeNull())
        expect(mocks.getPropertyTypes).toHaveBeenCalledTimes(2)
        expect(screen.getByRole("combobox", { name: /Tipo de propiedad/ })).toBeEnabled()
    })

    it("catálogo de estados caído: su propio aviso; el de tipos no se ve afectado", async () => {
        mocks.getStatusRecords.mockResolvedValueOnce([])
        render(<PropertyForm initialData={existing} />)
        expect(await screen.findByText(/No pudimos cargar los estados/)).toHaveTextContent("Se conserva el estado actual.")
        expect(screen.queryByText(/No pudimos cargar los tipos/)).toBeNull()
    })

    it("portada predeterminada: se muestra con vista previa y se dice que es la predeterminada", () => {
        render(<PropertyForm />)
        expect(screen.getByRole("img", { name: "Portada predeterminada" })).toHaveAttribute("src", DEFAULT_PROPERTY_THUMBNAIL_URL)
        expect(screen.getByText("Portada predeterminada: se usa hasta que subas una foto en Fotos.")).toBeInTheDocument()
        expect(screen.getByLabelText("Portada")).toHaveValue(DEFAULT_PROPERTY_THUMBNAIL_URL)
    })

    it("eliminar: solo al editar, en su zona de peligro, con confirmación que espera el resultado", async () => {
        const user = userEvent.setup()
        const { unmount } = render(<PropertyForm />)
        expect(screen.queryByRole("button", { name: "Eliminar propiedad" })).toBeNull()
        unmount()

        let resolveDelete!: () => void
        mocks.remove.mockReturnValue(new Promise<void>((done) => { resolveDelete = done }))
        render(<PropertyForm initialData={existing} />)
        await user.click(screen.getByRole("button", { name: "Eliminar propiedad" }))
        const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar esta propiedad?" })
        expect(dialog).toHaveTextContent("«Edificio Mirador»")
        await user.click(within(dialog).getByRole("button", { name: "Eliminar propiedad" }))
        expect(mocks.remove).toHaveBeenCalledWith(UUID)
        // Mientras borra, el diálogo sigue abierto y dice que está en ello.
        expect(within(dialog).getByRole("button", { name: "Eliminando…" })).toBeInTheDocument()
        resolveDelete()
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard/properties"))
    })

    it("si eliminar falla, el diálogo sigue abierto y se puede reintentar", async () => {
        const user = userEvent.setup()
        mocks.remove.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(undefined)
        render(<PropertyForm initialData={existing} />)
        await user.click(screen.getByRole("button", { name: "Eliminar propiedad" }))
        const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar esta propiedad?" })
        const action = within(dialog).getByRole("button", { name: "Eliminar propiedad" })
        // Confirmación destructiva: el mismo tratamiento que fotos y alojamientos.
        expect(action.className).toMatch(/destructive/)
        await user.click(action)
        await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1))
        expect(screen.getByRole("alertdialog", { name: "¿Eliminar esta propiedad?" })).toBeInTheDocument()
        expect(mocks.push).not.toHaveBeenCalled()
        await waitFor(() => expect(within(dialog).getByRole("button", { name: "Eliminar propiedad" })).toBeEnabled())

        await user.click(within(dialog).getByRole("button", { name: "Eliminar propiedad" }))
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard/properties"))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    })

    it("doble envío: dos clics seguidos en «Guardar cambios» producen un solo PUT", async () => {
        const user = userEvent.setup()
        let resolveUpdate!: (value: unknown) => void
        mocks.update.mockReturnValue(new Promise((done) => { resolveUpdate = done }))
        render(<PropertyForm initialData={existing} />)
        await screen.findByRole("combobox", { name: /Tipo de propiedad/ })
        await user.type(screen.getByLabelText(/Nombre de la propiedad/), " Norte")
        const save = screen.getByRole("button", { name: "Guardar cambios" })
        await user.click(save)
        await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
        // El botón ya está ocupado; el candado (`submitLockRef`) cubre además un segundo
        // `submit` del formulario (Enter en un campo, otro clic antes del re-render).
        await user.click(screen.getByRole("button", { name: "Guardando…" }))
        fireEvent.submit(document.querySelector("form")!)
        fireEvent.submit(document.querySelector("form")!)
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(mocks.update).toHaveBeenCalledTimes(1)
        resolveUpdate({ uuid: UUID })
        await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
        expect(mocks.update).toHaveBeenCalledTimes(1)
    })

    it("teclado: Tab recorre pestañas, campos de Detalles y la barra en orden, sin trampas", async () => {
        const user = userEvent.setup()
        render(<PropertyForm />)
        await screen.findByRole("combobox", { name: /Tipo de propiedad/ })
        await user.tab()
        expect(screen.getByRole("tab", { name: "Detalles" })).toHaveFocus()
        await user.keyboard("{ArrowRight}")
        expect(screen.getByRole("tab", { name: "Ubicación" })).toHaveFocus()
        await user.keyboard("{ArrowLeft}")
        // Radix pone el panel (`tabpanel`) en el orden de tabulación antes de su contenido.
        await user.tab()
        expect(screen.getByRole("tabpanel")).toHaveFocus()
        await user.tab()
        expect(screen.getByLabelText(/Nombre de la propiedad/)).toHaveFocus()
        await user.tab()
        expect(screen.getByLabelText(/Correo de contacto/)).toHaveFocus()
        await user.tab()
        expect(screen.getByLabelText(/Teléfono/)).toHaveFocus()
        await user.tab()
        expect(screen.getByRole("combobox", { name: /Tipo de propiedad/ })).toHaveFocus()
        // Hasta la barra: Cancelar y luego la acción principal, al final del recorrido.
        const cancel = screen.getByRole("button", { name: "Cancelar" })
        cancel.focus()
        await user.tab()
        expect(screen.getByRole("button", { name: "Crear propiedad" })).toHaveFocus()
    })

    it("cancelar vuelve a la lista sin guardar", async () => {
        const user = userEvent.setup()
        render(<PropertyForm initialData={existing} />)
        await user.type(screen.getByLabelText(/Nombre de la propiedad/), " Norte")
        await user.click(screen.getByRole("button", { name: "Cancelar" }))
        expect(mocks.push).toHaveBeenCalledWith("/dashboard/properties")
        expect(mocks.update).not.toHaveBeenCalled()
    })

    it("editar y guardar: PUT con el mismo serializador de siempre (el teléfono viaja tal cual)", async () => {
        const user = userEvent.setup()
        mocks.update.mockResolvedValue({ uuid: UUID })
        render(<PropertyForm initialData={existing} />)
        await screen.findByRole("combobox", { name: /Tipo de propiedad/ })
        const phone = screen.getByLabelText(/Teléfono/)
        await user.clear(phone)
        await user.type(phone, "+57 300 123 4567 ext. 204")
        await user.click(screen.getByRole("button", { name: "Guardar cambios" }))
        await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
        const [uuid, values] = mocks.update.mock.calls[0]
        expect(uuid).toBe(UUID)
        expect(values.phone).toBe("+57 300 123 4567 ext. 204")
        expect(values.name).toBe("Edificio Mirador")
        expect(screen.queryByRole("alert")).toBeNull()
    })
})
