import { describe, expect, it } from "vitest"
import type { PropertyFormData } from "../types"
import { buildPropertyCreatePayload } from "../services/properties-service"

/**
 * `POST /properties` acepta `automations`, pero el alta actual no tiene un paso
 * donde el PM elija proveedores. Por eso el payload neutral debe omitir la clave:
 * el backend crea los dos slots estructurales de identidad y el PM configura
 * principal/secundarios después, sin que el frontend elija Didit por él.
 */
describe("alta neutral de propiedad", () => {
    it("no siembra automations que el PM no eligió", () => {
        const payload = buildPropertyCreatePayload({
            name: "Apartamento",
            email: "pm@example.com",
            address: "Calle 1",
            city: "Bogotá",
            state: "Bogotá",
            countryId: 48,
            latitude: 4.6,
            longitude: -74.1,
            statusRecordId: 6,
            propertyTypeId: 103,
        } as PropertyFormData)

        expect(payload).not.toHaveProperty("automations")
    })
})
