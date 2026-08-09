import { describe, it, expect } from "vitest"
import {
    AVAILABLE_LANGUAGES,
    DEFAULT_LANGUAGE,
    dictionaries,
    isAvailableLanguage,
} from "./index"

describe("idiomas disponibles", () => {
    // El store arrancaba en 'en' mientras app/layout.tsx emitía <html lang="es">.
    it("el idioma por defecto es español, igual que el HTML", () => {
        expect(DEFAULT_LANGUAGE).toBe("es")
    })

    it("el idioma por defecto está entre los disponibles", () => {
        expect(AVAILABLE_LANGUAGES).toContain(DEFAULT_LANGUAGE)
    })

    // Existe un diccionario `en`, pero cubre ~20 cadenas y el resto de la app
    // está en español en el JSX. "Tener diccionario" no es "poder renderizar".
    it("no ofrece un idioma solo porque exista su diccionario", () => {
        expect(Object.keys(dictionaries)).toContain("en")
        expect(AVAILABLE_LANGUAGES).not.toContain("en")
    })

    describe("isAvailableLanguage", () => {
        it("acepta el español", () => {
            expect(isAvailableLanguage("es")).toBe(true)
        })

        it("rechaza el inglés mientras no haya librería", () => {
            expect(isAvailableLanguage("en")).toBe(false)
        })

        it("rechaza cualquier cosa que no sea un idioma", () => {
            expect(isAvailableLanguage("fr")).toBe(false)
            expect(isAvailableLanguage("")).toBe(false)
            expect(isAvailableLanguage(undefined)).toBe(false)
            expect(isAvailableLanguage(null)).toBe(false)
            expect(isAvailableLanguage(42)).toBe(false)
        })
    })
})
