import { describe, expect, it } from "vitest"
import {
    bySourceArrivedAsList, orphanRoutingEntries, readContractRouting, routingForMode, summarizeContractRouting, type SourceRouting } from "./contract-routing"

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


describe("orphanRoutingEntries", () => {
    const catalogo = new Set([21, 22, 23])
    const routing = { contract_type: "agreement_and_guarantee", provider_slug: "tufirma" } as const

    /**
     * Caso real (2026-09-03): `by_source["1"]` con el catálogo en 21/22/23. La
     * tarjeta lo mostraba («Canal 1 · …») y la pestaña Documentos lo filtraba
     * sin dejar rastro — «lo veo y no puedo tocarlo». La fila descartada tiene
     * que poder AVISARSE.
     */
    it("expone la clave que el catálogo no reconoce, con su routing intacto", () => {
        expect(orphanRoutingEntries({ "1": routing, "22": routing }, catalogo))
            .toEqual([{ sourceKey: "1", routing }])
    })

    it("no marca como huérfano lo que el editor sí puede mostrar", () => {
        // `all` y los ids del catálogo tienen fila propia en la pantalla.
        expect(orphanRoutingEntries({ all: routing, "21": routing }, catalogo)).toEqual([])
        expect(orphanRoutingEntries(undefined, catalogo)).toEqual([])
    })

    it("descarta la basura que ni siquiera es un routing", () => {
        // Una clave desconocida con un valor malformado no es una fila que el
        // PM deba ver — no hay nada legible que mostrarle.
        expect(orphanRoutingEntries(
            { "9": { contract_type: "??", provider_slug: 5 } as never },
            catalogo,
        )).toEqual([])
    })
})

describe("readContractRouting — ruteo leído por el backend (contrato 2026-10-19)", () => {
    const ready = {
        key: "21",
        channel: { id: 21, slug: "direct", name: "Directo" },
        contractType: "agreement_only",
        contractTypeLabel: "Contrato de alquiler",
        provider: { slug: "tufirma", name: "TuFirma Digital", label: "Firma digital (TuFirma)", signsInPortal: false },
        document: { uuid: "doc-1", updatedAt: "2026-10-19 21:11:50" },
        status: "ready",
        statusLabel: "Listo",
        summary: "Directo · Contrato de alquiler · Firma digital (TuFirma)",
    }

    it("lee los canales con sus textos", () => {
        const view = readContractRouting({ mode: "per_source", modeLabel: "Un contrato distinto por canal", channels: [ready], needsAttention: false })
        expect(view?.channels[0]).toMatchObject({
            key: "21",
            channel: { id: 21, slug: "direct", name: "Directo" },
            provider: { label: "Firma digital (TuFirma)", signsInPortal: false },
            status: "ready",
        })
        expect(view?.needsAttention).toBe(false)
    })

    it("un estado desconocido cuenta como «requiere atención» aunque el flag no venga", () => {
        const view = readContractRouting({ channels: [{ ...ready, status: "algo_nuevo" }] })
        expect(view?.needsAttention).toBe(true)
    })

    it("«todos los canales» trae id null", () => {
        const view = readContractRouting({ channels: [{ ...ready, key: "all", channel: { id: null, slug: "all", name: "Todos los canales" } }] })
        expect(view?.channels[0].channel).toEqual({ id: null, slug: "all", name: "Todos los canales" })
    })

    it("ausente o con otra forma es null: se usa el `by_source` crudo", () => {
        expect(readContractRouting(undefined)).toBeNull()
        expect(readContractRouting([ready])).toBeNull()
    })

    it("override de unidad: desactivado y origen del ruteo", () => {
        expect(readContractRouting({ disabled: true, channels: [], routingSource: "listing" }))
            .toMatchObject({ disabled: true, routingSource: "listing", channels: [] })
    })
})

describe("bySourceArrivedAsList", () => {
    it("solo la lista JSON (bug previo al 2026-10-19) cuenta; un objeto con claves desconocidas no", () => {
        expect(bySourceArrivedAsList({ by_source: [{}, {}] })).toBe(true)
        expect(bySourceArrivedAsList({ by_source: { 999: {} } })).toBe(false)
        expect(bySourceArrivedAsList(undefined)).toBe(false)
    })
})
