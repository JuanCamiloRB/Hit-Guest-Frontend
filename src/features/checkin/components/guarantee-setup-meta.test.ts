import { describe, it, expect } from "vitest"
import {
    describeGuaranteeSetupFailure,
    readUsableSetupIntent,
    type GuaranteeSetupFailure,
} from "./guarantee-setup-meta"
import type { GuaranteeSetupIntent } from "@/features/checkin/types/checkin"

/**
 * El caso real observado en producción el 2026-08-19: backend 200, el portal
 * mostró «hasta USD 200» (o sea `guaranteeAmount` y `currency` SÍ llegaron) y
 * aun así el formulario nunca se montó.
 */
function intentWith(overrides: Partial<GuaranteeSetupIntent>): GuaranteeSetupIntent {
    return {
        clientSecret: "seti_123_secret_abc",
        publishableKey: "pk_test_123",
        guaranteeAmount: 200,
        currency: "USD",
        ...overrides,
    }
}

describe("readUsableSetupIntent", () => {
    it("acepta un payload completo y devuelve los dos campos garantizados", () => {
        const result = readUsableSetupIntent(intentWith({}))

        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error("se esperaba ok")
        expect(result.intent.clientSecret).toBe("seti_123_secret_abc")
        expect(result.intent.publishableKey).toBe("pk_test_123")
    })

    // Los cuatro shapes que TypeScript da por imposibles (el tipo declara
    // `string`) pero que un 200 puede traer igual — que es exactamente por lo
    // que este chequeo existe en runtime.
    const rotas: Array<[string, Partial<GuaranteeSetupIntent>]> = [
        ["publishableKey ausente", { publishableKey: undefined as unknown as string }],
        ["publishableKey null", { publishableKey: null as unknown as string }],
        ["publishableKey vacía", { publishableKey: "" }],
        ["publishableKey solo espacios", { publishableKey: "   " }],
        ["clientSecret ausente", { clientSecret: undefined as unknown as string }],
        ["clientSecret vacío", { clientSecret: "" }],
    ]

    it.each(rotas)("rechaza como incomplete_payload: %s", (_label, overrides) => {
        const result = readUsableSetupIntent(intentWith(overrides))

        expect(result.ok).toBe(false)
        if (result.ok) throw new Error("se esperaba fallo")
        expect(result.cause).toBe("incomplete_payload")
    })

    it("NO bloquea por guaranteeAmount ni currency ausentes — son informativos", () => {
        const result = readUsableSetupIntent(
            intentWith({ guaranteeAmount: null, currency: undefined as unknown as string }),
        )

        expect(result.ok).toBe(true)
    })
})

describe("describeGuaranteeSetupFailure", () => {
    const causas: GuaranteeSetupFailure[] = [
        "incomplete_payload",
        "stripe_rejected",
        "stripe_blocked",
        "container_missing",
        "elements_failed",
        "backend_error",
    ]

    it("cubre las seis causas, sin dejar ninguna sin copy", () => {
        for (const causa of causas) {
            const ui = describeGuaranteeSetupFailure(causa)
            expect(ui.message.length).toBeGreaterThan(0)
            expect(ui.ref.length).toBeGreaterThan(0)
        }
    })

    it("asigna una referencia distinta a cada causa — si dos coinciden, el soporte no las distingue", () => {
        const refs = causas.map((c) => describeGuaranteeSetupFailure(c).ref)
        expect(new Set(refs).size).toBe(causas.length)
    })

    // El corazón del bug: estas tres causas compartían un único mensaje, así que
    // ver la pantalla no permitía saber cuál había ocurrido.
    it("da mensajes distintos a las causas que antes compartían texto", () => {
        const mensajes = [
            describeGuaranteeSetupFailure("incomplete_payload").message,
            describeGuaranteeSetupFailure("stripe_rejected").message,
            describeGuaranteeSetupFailure("elements_failed").message,
        ]
        expect(new Set(mensajes).size).toBe(3)
    })

    it("no ofrece reintento cuando el huésped no puede resolverlo", () => {
        expect(describeGuaranteeSetupFailure("incomplete_payload").canRetry).toBe(false)
        expect(describeGuaranteeSetupFailure("stripe_rejected").canRetry).toBe(false)
    })

    it("sí ofrece reintento en las causas transitorias o resolubles por el huésped", () => {
        expect(describeGuaranteeSetupFailure("stripe_blocked").canRetry).toBe(true)
        expect(describeGuaranteeSetupFailure("container_missing").canRetry).toBe(true)
        expect(describeGuaranteeSetupFailure("elements_failed").canRetry).toBe(true)
        expect(describeGuaranteeSetupFailure("backend_error").canRetry).toBe(true)
    })
})
