import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form"
import type { PlaceDetails } from "./AddressAutocomplete"

// Radix Popover (el Combobox) usa APIs de puntero y medición que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const mocks = vi.hoisted(() => ({
    getCountries: vi.fn(),
    getTimezonesGrouped: vi.fn(),
    /** La sugerencia que el buscador simulado entrega al pulsar «Elegir sugerencia». */
    suggestion: {} as Record<string, unknown>,
}))

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getCountries: mocks.getCountries, getTimezonesGrouped: mocks.getTimezonesGrouped },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

// El buscador real habla con el BFF de geocodificación: aquí es un campo de
// texto más un botón que entrega la sugerencia preparada por la prueba.
vi.mock("./AddressAutocomplete", async () => {
    const React = await import("react")
    function AddressAutocomplete({ value, onChange, onSelect, placeholder }: {
        value: string
        onChange: (value: string) => void
        onSelect: (details: PlaceDetails) => void
        placeholder?: string
    }) {
        return React.createElement(
            "div",
            null,
            React.createElement("input", {
                "aria-label": "Buscar dirección",
                value,
                placeholder,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
            }),
            React.createElement("button", {
                type: "button",
                onClick: () => onSelect(mocks.suggestion as unknown as PlaceDetails),
            }, "Elegir sugerencia"),
        )
    }
    return { AddressAutocomplete }
})

// El mapa se carga con `next/dynamic`; aquí el cargador devuelve directamente
// un botón que simula soltar el pin en unas coordenadas fijas.
vi.mock("next/dynamic", async () => {
    const React = await import("react")
    function MapMock({ lat, lng, zoom, onChange }: { lat: number; lng: number; zoom: number; onChange: (lat: number, lng: number) => void }) {
        return React.createElement("button", {
            type: "button",
            "data-lat": lat,
            "data-lng": lng,
            "data-zoom": zoom,
            onClick: () => onChange(6.25184, -75.56359),
        }, "Arrastrar pin")
    }
    return { default: () => MapMock }
})

import { PropertiesLocation } from "./PropertiesLocation"

const COUNTRIES = [
    { id: "48", name: "Colombia", extra: { iso2: "CO", emoji: "🇨🇴", timezones: ["America/Bogota"] } },
    { id: "233", name: "Estados Unidos", extra: { iso2: "US", emoji: "🇺🇸", timezones: ["America/New_York", "America/Chicago"] } },
]
const TIMEZONES = [
    { group: "América", options: [
        { id: "America/Bogota", name: "America/Bogota (Colombia)" },
        { id: "America/New_York", name: "America/New_York (US Est)" },
    ] },
]

const BOGOTA_SUGGESTION = {
    lat: 4.711,
    lng: -74.0721,
    addressLine1: "Carrera 7 # 71-21",
    addressLine2: "Oficina 801",
    formattedAddress: "Carrera 7 # 71-21, Bogotá, Colombia",
    city: "Bogotá",
    state: "Cundinamarca",
    countryCode: "CO",
}

const DEFAULTS = {
    address: "",
    addressDetail: "",
    state: "",
    city: "",
    countryId: 0,
    timezone: "",
    latitude: 0,
    longitude: 0,
}

function renderLocation(overrides: Partial<typeof DEFAULTS> = {}) {
    let form!: UseFormReturn<typeof DEFAULTS>
    function Wrapper() {
        form = useForm({ defaultValues: { ...DEFAULTS, ...overrides } })
        return <FormProvider {...form}><PropertiesLocation /></FormProvider>
    }
    const view = render(<Wrapper />)
    return { ...view, form: () => form }
}

/** Los catálogos ya llegaron: el país se puede abrir. */
async function catalogsReady() {
    await waitFor(() => expect(screen.getByRole("combobox", { name: /País/ })).toBeEnabled())
}

beforeEach(() => {
    mocks.getCountries.mockReset().mockResolvedValue(COUNTRIES)
    mocks.getTimezonesGrouped.mockReset().mockResolvedValue(TIMEZONES)
    mocks.suggestion = BOGOTA_SUGGESTION
})

describe("PropertiesLocation — campos y marcas", () => {
    it("marca como obligatorios solo dirección, departamento o estado, ciudad y país", async () => {
        const { container } = renderLocation()
        await catalogsReady()

        const labels = Array.from(container.querySelectorAll("label"))
        const required = labels.filter((label) => label.querySelector("span.text-danger"))
        expect(required.map((label) => label.textContent?.replace("*", "").trim())).toEqual([
            "Dirección",
            "Departamento o estado",
            "Ciudad",
            "País",
        ])
        expect(screen.getByText("Dirección, línea 2 · opcional").querySelector("span.text-danger")).toBeNull()
        expect(screen.getByText("Zona horaria").querySelector("span.text-danger")).toBeNull()
    })

    it("país y zona horaria son Combobox: el país muestra la bandera y guarda el id como número", async () => {
        const { form } = renderLocation()
        await catalogsReady()
        const user = userEvent.setup()

        await user.click(screen.getByRole("combobox", { name: /País/ }))
        const option = await screen.findByRole("option", { name: /Colombia/ })
        expect(option).toHaveTextContent("🇨🇴")
        await user.click(option)

        expect(form().getValues("countryId")).toBe(48)
        expect(screen.getByRole("combobox", { name: /País/ })).toHaveTextContent("Colombia")

        await user.click(screen.getByRole("combobox", { name: "Zona horaria" }))
        await user.click(await screen.findByRole("option", { name: /New_York/ }))
        expect(form().getValues("timezone")).toBe("America/New_York")
    })
})

describe("PropertiesLocation — sugerencia de dirección", () => {
    it("rellena dirección, línea 2, estado, ciudad, país, zona horaria (país de una sola zona) y el pin", async () => {
        const { form } = renderLocation()
        await catalogsReady()

        await userEvent.setup().click(screen.getByRole("button", { name: "Elegir sugerencia" }))

        expect(form().getValues()).toMatchObject({
            address: "Carrera 7 # 71-21",
            addressDetail: "Oficina 801",
            state: "Cundinamarca",
            city: "Bogotá",
            countryId: 48,
            timezone: "America/Bogota",
            latitude: 4.711,
            longitude: -74.0721,
        })
        const map = screen.getByRole("button", { name: "Arrastrar pin" })
        expect(map).toHaveAttribute("data-lat", "4.711")
        expect(map).toHaveAttribute("data-lng", "-74.0721")
    })

    it("con un país de varias zonas horarias, limpia la zona anterior en vez de adivinar", async () => {
        const { form } = renderLocation({ countryId: 48, timezone: "America/Bogota" })
        await catalogsReady()
        mocks.suggestion = { ...BOGOTA_SUGGESTION, countryCode: "US", city: "Miami", state: "Florida" }

        await userEvent.setup().click(screen.getByRole("button", { name: "Elegir sugerencia" }))

        expect(form().getValues("countryId")).toBe(233)
        expect(form().getValues("timezone")).toBe("")
    })

    it("si la sugerencia llega antes que el catálogo de países, aplica el país cuando el catálogo carga", async () => {
        let resolveCountries!: (value: typeof COUNTRIES) => void
        mocks.getCountries.mockReset().mockReturnValue(new Promise((resolve) => { resolveCountries = resolve }))
        const { form } = renderLocation()

        await userEvent.setup().click(screen.getByRole("button", { name: "Elegir sugerencia" }))
        expect(form().getValues("countryId")).toBe(0)

        resolveCountries(COUNTRIES)
        await waitFor(() => expect(form().getValues("countryId")).toBe(48))
        expect(form().getValues("timezone")).toBe("America/Bogota")
    })
})

describe("PropertiesLocation — mapa y coordenadas", () => {
    it("avisa cuando no hay ubicación y deja de avisar al soltar el pin, que escribe latitude/longitude", async () => {
        const { form } = renderLocation()
        await catalogsReady()
        expect(screen.getByText("Esta propiedad todavía no tiene ubicación en el mapa.")).toBeInTheDocument()
        expect(screen.getAllByText("—")).toHaveLength(2)

        await userEvent.setup().click(screen.getByRole("button", { name: "Arrastrar pin" }))

        expect(form().getValues("latitude")).toBe(6.25184)
        expect(form().getValues("longitude")).toBe(-75.56359)
        expect(form().getFieldState("latitude").isDirty).toBe(true)
        expect(screen.queryByText("Esta propiedad todavía no tiene ubicación en el mapa.")).not.toBeInTheDocument()
        // Las coordenadas se leen con cinco decimales.
        expect(screen.getByText("6.25184")).toBeInTheDocument()
        expect(screen.getByText("-75.56359")).toBeInTheDocument()
    })

    it("«Ajustar a mano» revela latitud y longitud como campos y escribir en ellos cambia las mismas claves", async () => {
        const { form } = renderLocation({ latitude: 10.39972, longitude: -75.51444 })
        await catalogsReady()
        const user = userEvent.setup()

        expect(screen.queryByRole("spinbutton", { name: "Latitud" })).not.toBeInTheDocument()
        const toggle = screen.getByRole("button", { name: "Ajustar a mano" })
        expect(toggle).toHaveAttribute("aria-expanded", "false")

        await user.click(toggle)
        expect(toggle).toHaveAttribute("aria-expanded", "true")
        const lat = screen.getByRole("spinbutton", { name: "Latitud" })
        const lng = screen.getByRole("spinbutton", { name: "Longitud" })
        expect(lat).toHaveValue(10.39972)
        expect(lng).toHaveValue(-75.51444)

        await user.clear(lat)
        await user.type(lat, "4.5")
        await user.clear(lng)
        await user.type(lng, "-74.1")
        expect(form().getValues("latitude")).toBe(4.5)
        expect(form().getValues("longitude")).toBe(-74.1)

        await user.click(toggle)
        expect(toggle).toHaveAttribute("aria-expanded", "false")
        expect(screen.queryByRole("spinbutton", { name: "Latitud" })).not.toBeInTheDocument()
    })
})

describe("PropertiesLocation — catálogos", () => {
    it("si los países no cargan, lo dice junto al campo y «Reintentar» vuelve a pedirlos", async () => {
        mocks.getCountries.mockReset().mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValueOnce(COUNTRIES)
        renderLocation()

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("No pudimos cargar los países. El país es obligatorio.")
        expect(mocks.getCountries).toHaveBeenCalledTimes(1)

        // Reintento con la promesa retenida: el aviso sigue y dice que está en ello.
        let release!: (value: typeof COUNTRIES) => void
        mocks.getCountries.mockReset().mockReturnValueOnce(new Promise<typeof COUNTRIES>((done) => { release = done }))
        await userEvent.setup().click(within(alert).getByRole("button", { name: "Reintentar" }))

        expect(mocks.getCountries).toHaveBeenCalledTimes(1)
        expect(within(screen.getByRole("alert")).getByText("Reintentando…")).toBeInTheDocument()
        release(COUNTRIES)
        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
        await catalogsReady()
    })

    it("si las zonas horarias no cargan, el país sigue sirviendo y la zona ofrece «Reintentar»", async () => {
        mocks.getTimezonesGrouped.mockReset().mockRejectedValue(new Error("HTTP 500"))
        renderLocation()

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("No pudimos cargar las zonas horarias.")
        await catalogsReady()
    })
})
