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

/** Todas las rutas «a.b.c» de un diccionario, para comparar sus formas. */
function keyPaths(node: unknown, prefix = ""): string[] {
    if (!node || typeof node !== "object") return [prefix]
    return Object.entries(node).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k))
}

describe("paridad es/en", () => {
    // Cada texto se escribe en los dos idiomas: así habilitar inglés es solo
    // añadir "en" a AVAILABLE_LANGUAGES, sin cadenas que caigan a su clave.
    it("los dos diccionarios tienen exactamente las mismas claves", () => {
        expect(keyPaths(dictionaries.es).sort()).toEqual(keyPaths(dictionaries.en).sort())
    })

    it("ningún texto está vacío", () => {
        for (const lang of ["es", "en"] as const) {
            const empty = keyPaths(dictionaries[lang]).filter((path) => {
                const value = path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], dictionaries[lang])
                return typeof value !== "string" || value.trim() === ""
            })
            expect(empty, lang).toEqual([])
        }
    })

    it("los parámetros {{x}} coinciden entre idiomas", () => {
        const params = (lang: "es" | "en", path: string) => {
            const value = path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], dictionaries[lang])
            return [...String(value).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
        }
        for (const path of keyPaths(dictionaries.es)) {
            expect(params("es", path), path).toEqual(params("en", path))
        }
    })
})
