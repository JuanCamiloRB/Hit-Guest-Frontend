import { describe, expect, it } from "vitest"
import { DEFAULT_CANCELLATION_POLICY, DEFAULT_LISTING_THUMBNAIL_URL, DEFAULT_PROPERTY_THUMBNAIL_URL } from "./property-defaults"

/**
 * Fase 0: lo que viaja por omisión aunque el PM no lo toque. Cambiar cualquiera
 * de estos valores es una decisión funcional (plan `20261116_propiedad-form-ux.md`
 * §8.2), no de diseño.
 */
describe("valores por omisión que viajan al backend", () => {
    it("portadas predeterminadas de propiedad y alojamiento", () => {
        expect(DEFAULT_PROPERTY_THUMBNAIL_URL).toBe("https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60")
        expect(DEFAULT_LISTING_THUMBNAIL_URL).toBe("https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=60")
    })

    it("la política de cancelación con la que nace un alojamiento", () => {
        expect(DEFAULT_CANCELLATION_POLICY).toBe("STANDARD")
    })
})
