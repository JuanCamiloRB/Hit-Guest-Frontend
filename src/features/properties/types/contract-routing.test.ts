import { describe, expect, it } from "vitest"
import { routingForMode, summarizeContractRouting, type SourceRouting } from "./contract-routing"

const agreement: SourceRouting = {
    contract_type: "agreement_only",
    provider_slug: "hitguest_signature",
}
const guarantee: SourceRouting = {
    contract_type: "guarantee_only",
    provider_slug: "tufirma",
}

describe("routingForMode", () => {
    it("keeps only the all route in all_sources mode", () => {
        expect(
            routingForMode("all_sources", {
                all: guarantee,
                "22": agreement,
            }),
        ).toEqual({ all: guarantee })
    })

    it("does not promote a stale channel route to all_sources", () => {
        expect(routingForMode("all_sources", { "22": agreement })).toEqual({})
    })

    it("removes all, unknown and malformed keys in per_source mode", () => {
        expect(
            routingForMode(
                "per_source",
                {
                    all: guarantee,
                    "22": agreement,
                    "999": guarantee,
                    invalid: agreement,
                },
                new Set([22, 23]),
            ),
        ).toEqual({ "22": agreement })
    })
})

describe("summarizeContractRouting", () => {
    it("describe el canal único en modo all_sources", () => {
        expect(summarizeContractRouting({
            contract_mode: "all_sources",
            by_source: { all: guarantee },
        })).toEqual({
            mode: "all_sources",
            channelCount: 1,
            contractType: "guarantee_only",
            providerSlug: "tufirma",
            channels: [{ sourceKey: "all", contractType: "guarantee_only", providerSlug: "tufirma" }],
        })
    })

    it("cuenta los canales en modo per_source sin inventar un proveedor único", () => {
        // Con proveedores distintos por canal no hay una respuesta sola a "quién
        // firma" a nivel agregado — pero `channels` enumera cada canal para que la
        // tarjeta pueda MOSTRAR qué hay configurado en vez de solo contarlo.
        expect(summarizeContractRouting({
            contract_mode: "per_source",
            by_source: { "22": agreement, "23": guarantee },
        })).toEqual({
            mode: "per_source",
            channelCount: 2,
            contractType: null,
            providerSlug: null,
            channels: [
                { sourceKey: "22", contractType: "agreement_only", providerSlug: "hitguest_signature" },
                { sourceKey: "23", contractType: "guarantee_only", providerSlug: "tufirma" },
            ],
        })
    })

    it("devuelve null cuando la automatización todavía no tiene routing", () => {
        expect(summarizeContractRouting({})).toBeNull()
        expect(summarizeContractRouting(null)).toBeNull()
        expect(summarizeContractRouting({ contract_mode: "all_sources", by_source: {} })).toBeNull()
    })

    it("ignora las claves que el modo activo no admite", () => {
        // Datos legacy pueden traer `all` y ids numéricos a la vez; el resumen
        // tiene que contar lo mismo que se va a guardar, no lo que quedó colgado.
        expect(summarizeContractRouting({
            contract_mode: "all_sources",
            by_source: { all: agreement, "22": guarantee },
        })?.channelCount).toBe(1)
    })

    it("no reporta un proveedor vacío como configurado", () => {
        expect(summarizeContractRouting({
            contract_mode: "all_sources",
            by_source: { all: { contract_type: "agreement_only", provider_slug: "" } },
        })?.providerSlug).toBeNull()
    })
})

