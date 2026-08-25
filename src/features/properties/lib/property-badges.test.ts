import { describe, expect, it } from "vitest"
import { derivePropertyBadges, type PropertyAutomationOverviewRow } from "./property-badges"

const row = (
    providerSlug: string | null,
    statusProviderId = 8,
    parameters?: Record<string, unknown>,
): PropertyAutomationOverviewRow => ({ providerSlug, statusProviderId, parameters })

const labels = (rows: PropertyAutomationOverviewRow[] | null) =>
    derivePropertyBadges(rows)?.map((b) => b.label)

describe("derivePropertyBadges — solo lo que el backend afirma", () => {
    it("deriva identidad, contrato con tipo, y operativas activas", () => {
        expect(labels([
            row("didit"),
            row("hitguest_signature", 8, {
                contract_mode: "all_sources",
                by_source: { all: { contract_type: "agreement_and_guarantee", provider_slug: "tufirma" } },
            }),
            row("tra_colombia"),
            row("sire_colombia"),
            row("sire_colombia"), // check-out: mismo slug, una sola insignia
            row("ttlock"),
        ])).toEqual([
            "Verificación avanzada",
            "Contrato de garantía y alquiler",
            "TRA",
            "SIRE",
            "TTLock",
        ])
    })

    it("las apagadas no cuentan, y sin TTLock activa afirma la ausencia", () => {
        expect(labels([row("didit"), row("ttlock", 10)]))
            .toEqual(["Verificación avanzada", "Sin cerradura"])
    })

    it("firma activa sin routing legible: 'Contrato' a secas, sin inventar el tipo", () => {
        expect(labels([row("tufirma", 8, {})])).toContain("Contrato")
    })

    it("per_source con tipos distintos: una insignia por tipo, no por canal", () => {
        expect(labels([
            row("hitguest_signature", 8, {
                contract_mode: "per_source",
                by_source: {
                    "21": { contract_type: "agreement_only", provider_slug: "hitguest_signature" },
                    "22": { contract_type: "agreement_only", provider_slug: "hitguest_signature" },
                    "23": { contract_type: "guarantee_only", provider_slug: "tufirma" },
                },
            }),
        ])).toEqual(["Contrato de alquiler", "Contrato de garantía", "Sin cerradura"])
    })

    it("un slug activo desconocido se muestra con su slug, nunca se oculta", () => {
        expect(labels([row("nuevo-proveedor")])).toContain("nuevo_proveedor")
    })

    it("null significa 'no sabemos': ni insignias ni ausencias afirmadas", () => {
        expect(derivePropertyBadges(null)).toBeNull()
    })

    it("lista vacía con datos en la mano: solo la ausencia de cerradura", () => {
        expect(labels([])).toEqual(["Sin cerradura"])
    })
})
