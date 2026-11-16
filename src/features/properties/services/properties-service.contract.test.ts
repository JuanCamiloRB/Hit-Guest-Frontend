import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }))
vi.mock("@/lib/api-client", () => ({
    apiClient: { get: vi.fn(), post: mocks.post, put: mocks.put, patch: vi.fn(), delete: vi.fn() },
    handleSessionExpired: vi.fn(),
}))

import { propertiesService } from "./properties-service"
import { formDataToApiPayload, type PropertyFormData } from "../types"

/**
 * Fase 0: el TRANSPORTE de la propiedad, congelado. El serializador ya está
 * fijado en `types/property-form-contract.test.ts`; esto fija que el servicio
 * manda exactamente ese cuerpo, sin envolverlo ni tocarlo, a la ruta correcta.
 */

const data = {
    name: "Edificio Mirador", description: "", email: "contacto@mirador.co", phone: "+57 300 123 4567 ext. 204",
    address: "Carrera 1 # 2-3", addressDetail: "", city: "Cartagena", state: "Bolívar", countryId: 48,
    latitude: 10.39972, longitude: -75.51444, timezone: "", statusRecordId: 6, propertyTypeId: 102,
    thumbnailUrl: "https://cdn.example/portada.jpg", communicationsLocale: "es",
    checkIn: "15:00", checkOut: "11:00", cancellationPolicy: "STANDARD", amenities: ["46"],
    wifiNetwork: "", wifiPassword: "", picturesUrl: [], units: [{ name: "Suite 101" }], policies: [], roomTypes: [],
    externalPmsIds: undefined,
} as unknown as PropertyFormData

describe("propertiesService — lo que llega a la red, congelado", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.post.mockResolvedValue({ data: { uuid: "p-1" } })
        mocks.put.mockResolvedValue({ data: { uuid: "p-1" } })
    })

    it("crear: POST /properties con el cuerpo del serializador tal cual, sin `automations` ni `units`", async () => {
        const result = await propertiesService.create(data)
        expect(mocks.post).toHaveBeenCalledTimes(1)
        const [url, body] = mocks.post.mock.calls[0]
        expect(url).toMatch(/\/properties$/)
        expect(body).toEqual(formDataToApiPayload(data))
        expect("automations" in body).toBe(false)
        expect("units" in body).toBe(false)
        expect(body.phone).toBe("+57 300 123 4567 ext. 204")
        // La respuesta se desenvuelve: el formulario lee `uuid` directo.
        expect(result).toEqual({ uuid: "p-1" })
    })

    it("editar: PUT /properties/{uuid} con el mismo cuerpo (el uuid va en la ruta, no en el cuerpo)", async () => {
        await propertiesService.update("p-1", data)
        expect(mocks.put).toHaveBeenCalledTimes(1)
        const [url, body] = mocks.put.mock.calls[0]
        expect(url).toMatch(/\/properties\/p-1$/)
        expect(body).toEqual(formDataToApiPayload(data))
        expect("uuid" in body).toBe(false)
    })
})
