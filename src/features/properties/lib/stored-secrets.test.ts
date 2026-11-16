import { describe, expect, it } from "vitest"
import { hasCredentialValue, maskedSecret, secretPresence } from "./stored-secrets"
import { readSecretHints, readSecretMetadata, readStoredSecretKeys } from "../services/automation-service"

describe("secretPresence", () => {
    it("el valor llegó: lo ve el dueño", () => {
        expect(secretPresence({ parameters: { token: "abc" }, storedSecretKeys: ["token"] }, "token")).toEqual({ kind: "visible" })
    })

    it("guardado sin valor: oculto, con la pista si la hay", () => {
        expect(secretPresence({ parameters: { rnt: "1" }, storedSecretKeys: ["token"], secretHints: { token: "3f9a" } }, "token"))
            .toEqual({ kind: "hidden", hint: "3f9a" })
        expect(secretPresence({ parameters: {}, storedSecretKeys: ["password"], secretHints: {} }, "password"))
            .toEqual({ kind: "hidden", hint: null })
    })

    it("sin valor ni registro de guardado: falta (también con un backend anterior a la nota)", () => {
        expect(secretPresence({ parameters: { token: "" }, storedSecretKeys: [] }, "token")).toEqual({ kind: "missing" })
        expect(secretPresence({ parameters: {} }, "token")).toEqual({ kind: "missing" })
        expect(secretPresence(null, "token")).toEqual({ kind: "missing" })
    })

    it("hasCredentialValue cuenta lo guardado aunque no se vea; maskedSecret nunca muestra más que la pista", () => {
        expect(hasCredentialValue({ parameters: {}, storedSecretKeys: ["token"] }, "token")).toBe(true)
        expect(hasCredentialValue({ parameters: {} }, "token")).toBe(false)
        expect(maskedSecret("3f9a")).toBe("••••3f9a")
        expect(maskedSecret(null)).toBe("••••••••")
    })
})

describe("lectura de los metadatos de secretos (nota 2026-11-12)", () => {
    it("acepta camelCase y snake_case, y descarta lo mal formado", () => {
        expect(readStoredSecretKeys({ storedSecretKeys: ["token"] })).toEqual(["token"])
        expect(readStoredSecretKeys({ stored_secret_keys: ["password"] })).toEqual(["password"])
        expect(readStoredSecretKeys({ storedSecretKeys: "token" })).toBeUndefined()
        expect(readStoredSecretKeys({ storedSecretKeys: [1] })).toBeUndefined()
    })

    it("una pista solo vale si son exactamente 4 caracteres: nunca se muestra un valor completo", () => {
        expect(readSecretHints({ secretHints: { token: "3f9a", client_secret: "TOKEN-COMPLETO-FILTRADO" } }))
            .toEqual({ token: "3f9a" })
        expect(readSecretHints({ secret_hints: {} })).toEqual({})
        expect(readSecretHints({ secretHints: ["3f9a"] })).toBeUndefined()
    })

    it("la completitud en null (fuera de TRA/SIRE o propiedad en modo por alojamiento) queda ausente", () => {
        expect(readSecretMetadata({ credentialsComplete: null, missingCredentialKeys: null, storedSecretKeys: [], secretHints: {} }))
            .toEqual({ storedSecretKeys: [], secretHints: {} })
    })
})
