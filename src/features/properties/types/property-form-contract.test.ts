import { describe, expect, it } from "vitest"
import { formDataToApiPayload, type PropertyFormData } from "./index"
import { DEFAULT_PROPERTY_THUMBNAIL_URL } from "../lib/property-defaults"

/**
 * Fase 0 del rediseño del formulario de propiedad: el payload de
 * `POST/PUT /properties` queda CONGELADO. Si una prueba falla por un cambio de
 * diseño, el diseño está mal, no la prueba.
 */

/** `extra` siempre viene: el tipo lo declara opcional, el contrato no. */
const extraOf = (payload: ReturnType<typeof formDataToApiPayload>) => payload.extra as NonNullable<typeof payload.extra>

const full = {
    name: "Edificio Mirador",
    description: "Frente al mar",
    email: "contacto@mirador.co",
    phone: "+57 300 123 4567 ext. 204",
    address: "Carrera 1 # 2-3",
    addressDetail: "Torre B",
    city: "Cartagena",
    state: "Bolívar",
    countryId: 48,
    latitude: 10.39972,
    longitude: -75.51444,
    timezone: "America/Bogota",
    statusRecordId: 6,
    propertyTypeId: 102,
    thumbnailUrl: "https://cdn.example/portada.jpg",
    communicationsLocale: "es",
    checkIn: "15:00",
    checkOut: "11:00",
    cancellationPolicy: "STANDARD",
    amenities: ["46", "47", "no-numérica"],
    wifiNetwork: "Mirador-5G",
    wifiPassword: "secreto",
    picturesUrl: ["https://cdn.example/vieja.jpg", "https://cdn.example/dos.jpg"],
    units: [],
    policies: [{ name: "Mascotas", description: "No", type: "house" }],
    roomTypes: [{ id: 1 }],
    automationSettings: { welcome_message: true },
    externalPmsIds: [{ id: 9, sourcePmsId: 134, externalId: " ABC-1 " }, { sourcePmsId: 100, externalId: "" }],
} as unknown as PropertyFormData

describe("formDataToApiPayload — el contrato con el backend, congelado", () => {
    it("la forma exacta con todo informado", () => {
        expect(formDataToApiPayload(full)).toEqual({
            name: "Edificio Mirador",
            description: "Frente al mar",
            email: "contacto@mirador.co",
            // Texto libre, sin normalizar: extensiones, espacios, lo que el PM escribió.
            phone: "+57 300 123 4567 ext. 204",
            address: "Carrera 1 # 2-3",
            addressDetail: "Torre B",
            city: "Cartagena",
            state: "Bolívar",
            countryId: 48,
            latitude: "10.39972",
            longitude: "-75.51444",
            timezone: "America/Bogota",
            statusRecordId: 6,
            propertyTypeId: 102,
            extra: {
                currency: "COP",
                communicationsLocale: "es",
                thumbnailUrl: "https://cdn.example/portada.jpg",
                checkIn: "15:00",
                checkOut: "11:00",
                cancellationPolicy: "STANDARD",
                amenities: [46, 47],
                wifiDetails: { network: "Mirador-5G", password: "secreto" },
                // La portada REEMPLAZA a la primera foto, no se apila.
                picturesUrl: ["https://cdn.example/portada.jpg", "https://cdn.example/dos.jpg"],
                policies: [{ name: "Mascotas", description: "No", type: "house" }],
                roomTypes: [{ id: 1 }],
            },
            // Filas completas, recortadas, con el id de las existentes; la incompleta se cae.
            externalPmsIds: [{ id: 9, sourcePmsId: 134, externalId: "ABC-1" }],
        })
    })

    it("`automationSettings` y `units` NO viajan", () => {
        const payload = formDataToApiPayload(full) as unknown as Record<string, unknown>
        expect("automationSettings" in payload).toBe(false)
        expect("units" in payload).toBe(false)
        expect("automationSettings" in (payload.extra as object)).toBe(false)
    })

    it("vacíos: teléfono, descripción y línea 2 van como null; la zona horaria se omite; coordenadas 0 como texto", () => {
        const payload = formDataToApiPayload({
            ...full, phone: "", description: "", addressDetail: "", timezone: "", latitude: 0, longitude: 0,
        })
        expect(payload).toMatchObject({ phone: null, description: null, addressDetail: null, latitude: "0", longitude: "0" })
        expect("timezone" in payload).toBe(false)
        const absent = formDataToApiPayload({ ...full, latitude: undefined, longitude: undefined } as unknown as PropertyFormData)
        expect(absent).toMatchObject({ latitude: "0.00000000", longitude: "0.00000000" })
    })

    it("la portada predeterminada viaja tal cual y se vuelve la primera foto cuando no hay fotos", () => {
        const payload = formDataToApiPayload({ ...full, thumbnailUrl: DEFAULT_PROPERTY_THUMBNAIL_URL, picturesUrl: [] })
        expect(extraOf(payload).thumbnailUrl).toBe(DEFAULT_PROPERTY_THUMBNAIL_URL)
        expect(extraOf(payload).picturesUrl).toEqual([DEFAULT_PROPERTY_THUMBNAIL_URL])
        // Sin portada, las fotos quedan como están y no se agrega nada.
        const none = formDataToApiPayload({ ...full, thumbnailUrl: "" })
        expect(extraOf(none).picturesUrl).toEqual(["https://cdn.example/vieja.jpg", "https://cdn.example/dos.jpg"])
        expect(extraOf(none).thumbnailUrl).toBe("")
    })

    it("la portada no se duplica si ya está en la galería", () => {
        const payload = formDataToApiPayload({ ...full, thumbnailUrl: "https://cdn.example/dos.jpg" })
        expect(extraOf(payload).picturesUrl).toEqual(["https://cdn.example/dos.jpg"])
    })

    it("externalPmsIds: omitido = no tocar; [] = borrar todas", () => {
        const omitted = formDataToApiPayload({ ...full, externalPmsIds: undefined })
        expect("externalPmsIds" in omitted).toBe(false)
        const cleared = formDataToApiPayload({ ...full, externalPmsIds: [] })
        expect(cleared.externalPmsIds).toEqual([])
    })

    it("los campos sin interfaz (horarios, política, wifi, policies, roomTypes) viajan tal cual, y la moneda es COP fija", () => {
        const payload = formDataToApiPayload({ ...full, checkIn: undefined, wifiNetwork: undefined, policies: undefined } as unknown as PropertyFormData)
        expect(extraOf(payload)).toMatchObject({ currency: "COP", checkOut: "11:00", cancellationPolicy: "STANDARD", wifiDetails: { network: undefined, password: "secreto" } })
        expect("checkIn" in extraOf(payload)).toBe(true)
        expect(extraOf(payload).checkIn).toBeUndefined()
    })

    it("sin idioma de comunicaciones se manda el predeterminado; el tipo de propiedad siempre numérico", () => {
        const payload = formDataToApiPayload({ ...full, communicationsLocale: undefined, propertyTypeId: "102" } as unknown as PropertyFormData)
        expect(extraOf(payload).communicationsLocale).toBe("es")
        expect(payload.propertyTypeId).toBe(102)
    })
})
