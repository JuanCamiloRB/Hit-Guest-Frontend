import { describe, expect, it } from "vitest"
import { resolveAutocompleteProvider } from "./provider"

describe("resolveAutocompleteProvider", () => {
    it("activa Google con la clave aunque la variable opcional no exista", () => {
        expect(resolveAutocompleteProvider({ googleApiKey: "server-key" })).toBe("google")
        expect(resolveAutocompleteProvider({ provider: "google", googleApiKey: "server-key" }))
            .toBe("google")
    })

    it("no habilita Google sin clave", () => {
        expect(resolveAutocompleteProvider({ provider: "google" })).toBeNull()
    })

    it("solo habilita Nominatim con una instancia administrada explícita", () => {
        expect(resolveAutocompleteProvider({ provider: "nominatim" })).toBeNull()
        expect(resolveAutocompleteProvider({
            provider: "nominatim",
            nominatimBaseUrl: "https://nominatim.example.com",
        })).toBe("nominatim")
    })
})

