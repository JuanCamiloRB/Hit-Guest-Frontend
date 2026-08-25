import { describe, it, expect } from "vitest"
import { sanitizeProvider } from "./automation-service"

/**
 * El backend serializa el modelo `Provider` COMPLETO cuando viene sideloaded —
 * incluidos sus `parameters`, donde TuFirma y Stripe Card On File guardan tokens
 * y llaves. Lo tiene priorizado de su lado; esto es defensa adicional: lo que no
 * entra al modelo no puede terminar en el estado de React, en un `console.log`
 * ni en un reporte de error.
 *
 * La allowlist es PROFUNDA a propósito, y estas pruebas existen para que siga
 * siéndolo: recortar solo el primer nivel dejaba pasar cualquier secreto que
 * viajara dentro de una rama permitida.
 */
describe("sanitizeProvider", () => {
    it("descarta cualquier clave de `parameters` que no esté permitida", () => {
        const result = sanitizeProvider({
            id: 1002,
            name: "TuFirma Digital",
            description: null,
            order: 0,
            statusProviderId: 8,
            parameters: {
                slug: "tufirma",
                api_token: "SECRETO",
                secret_key: "SECRETO",
                v1: { externalData: { password: "SECRETO" } },
            },
        })

        expect(result?.parameters).toEqual({ slug: "tufirma" })
        expect(result?.id).toBe(1002)
        expect(result?.name).toBe("TuFirma Digital")
    })

    it("descarta también las claves desconocidas de la RAÍZ del provider", () => {
        // `...provider` conservaba cualquier campo nuevo del backend — un
        // `credentials` o un `accessToken` a nivel raíz entraba entero.
        const result = sanitizeProvider({
            id: 1, name: "x", description: null, order: 0, statusProviderId: 8,
            parameters: { slug: "ttlock" },
            credentials: { accessToken: "SECRETO" },
            integrations: [{ token: "SECRETO" }],
        }) as Record<string, unknown> | null

        expect(result).not.toHaveProperty("credentials")
        expect(result).not.toHaveProperty("integrations")
    })

    it("vacía los VALORES de los parámetros de cada slot, conservando las claves", () => {
        // Este es el agujero que dejaba una allowlist superficial: `default_setup`
        // estaba permitido y arrastraba lo que llevara adentro. Las claves son el
        // contrato (qué campos pedirle al PM); los valores no se leen nunca.
        const result = sanitizeProvider({
            id: 1001, name: "TTlock", description: null, order: 0, statusProviderId: 8,
            parameters: {
                slug: "ttlock",
                default_setup: {
                    enabled: true,
                    slots: [{
                        name: "Smart Lock Codes",
                        order: 20,
                        guest_type: "all",
                        status_provider_id: 10,
                        parameters: { username: "", password: "", client_secret: "SECRETO" },
                        campo_interno: "no debería pasar",
                    }],
                },
            },
        })

        const slot = result?.parameters.default_setup?.slots[0] as unknown as Record<string, unknown>
        expect(Object.keys(slot.parameters as object)).toEqual(["username", "password", "client_secret"])
        expect(slot.parameters).toEqual({ username: "", password: "", client_secret: "" })
        expect(slot).not.toHaveProperty("campo_interno")
    })

    it("recorta las ramas permitidas campo por campo", () => {
        const result = sanitizeProvider({
            id: 1005, name: "HIT Guest", description: null, order: 0, statusProviderId: 8,
            parameters: {
                slug: "hitguest_signature",
                internalUse: { path: "hitguest_signature", tokenName: "x", tokenAbilities: ["y"] },
                billing: { billable: false, unit_cost: 0, secret_rate_key: "SECRETO" },
                signature: { synchronous: true, contract_types: ["agreement_only"], private_key: "SECRETO" },
                applicable_countries: ["ALL"],
                verification_type: "session",
            },
        })

        expect(result?.parameters).toEqual({
            slug: "hitguest_signature",
            // De `internalUse` solo sobrevive `path`: `tokenName` y
            // `tokenAbilities` describen credenciales y no se usan.
            internalUse: { path: "hitguest_signature" },
            billing: { billable: false, unit_cost: 0 },
            signature: { synchronous: true, contract_types: ["agreement_only"] },
            applicable_countries: ["ALL"],
            verification_type: "session",
        })
    })

    it("ignora un `applicable_countries` que no sea un array de strings", () => {
        const result = sanitizeProvider({
            id: 1, name: "x", description: null, order: 0, statusProviderId: 8,
            parameters: { slug: "x", applicable_countries: [{ code: "CO", key: "SECRETO" }] },
        })

        expect(result?.parameters).not.toHaveProperty("applicable_countries")
    })

    it("tolera null, undefined y un provider sin parameters", () => {
        expect(sanitizeProvider(null)).toBeNull()
        expect(sanitizeProvider(undefined)).toBeNull()
        expect(sanitizeProvider("no soy un objeto")).toBeNull()
        // Un objeto incompleto no se fuerza al tipo Provider con un cast.
        expect(sanitizeProvider({ id: 1 })).toBeNull()
    })
})
