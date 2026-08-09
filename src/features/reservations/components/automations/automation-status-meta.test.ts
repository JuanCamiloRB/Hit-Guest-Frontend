import { describe, it, expect } from "vitest"
import { AUTOMATION_DEFINITIONS } from "@/features/properties/data/automation-definitions"
import type { AutomationLiveStatus } from "@/features/properties/types/automation"
import {
    STATUS_META,
    NOT_APPLICABLE_META,
    PROVIDER_LABELS,
    getStatusMeta,
    automationTitle,
} from "./automation-status-meta"

describe("PROVIDER_LABELS", () => {
    // El PM configura "Verificación avanzada"/"esencial" en Propiedades;
    // mostrarle "Didit" o "AWS Textract" en Operaciones le hablaba de un
    // proveedor que nunca vio, con otro vocabulario para lo mismo.
    it("usa las mismas palabras que la pantalla de configuración", () => {
        expect(PROVIDER_LABELS.didit).toBe("Verificación avanzada")
        expect(PROVIDER_LABELS.textract).toBe("Verificación esencial")
    })

    // Las definiciones escriben los slugs con guion; el API los manda con
    // guion bajo. Sin canonicalizar, estas claves no existirían.
    it("indexa por el slug canónico que llega del API", () => {
        expect(PROVIDER_LABELS.pdf_report).toBeDefined()
        expect(PROVIDER_LABELS.tra_colombia).toBeDefined()
        expect(PROVIDER_LABELS.sire_colombia).toBeDefined()
    })

    it("nombra al organismo donde aporta más que el proveedor", () => {
        expect(PROVIDER_LABELS.sire_colombia).toBe("Migración Colombia · SIRE")
        expect(PROVIDER_LABELS.tra_colombia).toBe("MinCIT · TRA")
    })
})

describe("automationTitle", () => {
    /** El título canónico que el PM ve al configurar la propiedad. */
    const titleOf = (definitionId: string) =>
        AUTOMATION_DEFINITIONS.find((d) => d.id === definitionId)!.title

    // Se asierta el JOIN (nombre inglés → definición correcta), no el texto:
    // si se copiaran los strings acá volveríamos a tener dos listas que se
    // desincronizan, que es justo el bug que esto arregla.
    it("resuelve el título desde la definición canónica de Propiedades", () => {
        expect(automationTitle("didit", "Identity Verification - Main Guest"))
            .toBe(titleOf("identity-verification-main"))
        expect(automationTitle("textract", "Identity Verification - Secondary Guests"))
            .toBe(titleOf("identity-verification-secondary"))
        expect(automationTitle("pdf_report", "Guest Report PDF"))
            .toBe(titleOf("guest-report-pdf"))
        expect(automationTitle("ttlock", "Smart Lock Codes"))
            .toBe(titleOf("smart-lock-codes"))
    })

    // Operaciones y Propiedades nombraban la misma automatización distinto
    // ("Códigos de acceso" vs "Códigos de Cerradura Inteligente").
    it("usa las mismas palabras que la pantalla de configuración", () => {
        expect(automationTitle("ttlock", "Smart Lock Codes"))
            .toBe("Códigos de Cerradura Inteligente")
    })

    it("tells the two identity-verification rows apart despite the shared slug", () => {
        const main = automationTitle("didit", "Identity Verification - Main Guest")
        const secondary = automationTitle("didit", "Identity Verification - Secondary Guests")
        expect(main).not.toBe(secondary)
    })

    it("is case- and dash-insensitive", () => {
        expect(automationTitle("didit", "IDENTITY VERIFICATION – MAIN GUEST"))
            .toBe(titleOf("identity-verification-main"))
    })

    // La fila de firma puede llegar con `tufirma` (legacy) o `hitguest_signature`
    // y con un nombre que no sea "Digital Contract", así que se resuelve por slug.
    it("lets a provider override win over the name map", () => {
        expect(automationTitle("tufirma", "Digital Contract")).toBe(titleOf("digital-contract"))
        expect(automationTitle("hitguest_signature", "Whatever The Backend Calls It"))
            .toBe(titleOf("digital-contract"))
    })

    // Regresión: la normalización usaba `\s*` alrededor del guion, así que el
    // guion interno de "Check-in" se convertía en " - " y la clave terminaba
    // como "sire colombia - check - in". Las dos entradas de SIRE del mapa eran
    // código muerto y la fila mostraba el nombre en inglés.
    // Nombres tomados de una respuesta real de /automation-status.
    it("no rompe el guion interno de Check-in/Check-out", () => {
        expect(automationTitle("sire_colombia", "SIRE Colombia - Check-in"))
            .toBe(titleOf("sire-colombia-checkin"))
        expect(automationTitle("sire_colombia", "SIRE Colombia - Check-out"))
            .toBe(titleOf("sire-colombia-checkout"))
    })

    // Los 6 nombres exactos que devuelve /automation-status para una propiedad
    // configurada: ninguno debe quedarse en inglés.
    it("traduce los nombres reales del payload de automation-status", () => {
        const real: [string, string][] = [
            ["didit", "Identity Verification - Main Guest"],
            ["textract", "Identity Verification - Secondary Guests"],
            ["hitguest_signature", "Digital Contract"],
            ["pdf_report", "Guest Report PDF"],
            ["sire_colombia", "SIRE Colombia - Check-in"],
            ["sire_colombia", "SIRE Colombia - Check-out"],
        ]
        for (const [slug, name] of real) {
            expect(automationTitle(slug, name), name).not.toBe(name)
        }
    })

    it("falls back to the raw backend name instead of hiding an unknown automation", () => {
        expect(automationTitle("brand_new", "Something Unmapped")).toBe("Something Unmapped")
    })
})

describe("getStatusMeta", () => {
    it("maps every live status to a tone", () => {
        const statuses: AutomationLiveStatus[] = ["completed", "failed", "pending", "not_started"]
        for (const status of statuses) {
            expect(STATUS_META[status], status).toBeDefined()
        }
        expect(STATUS_META.completed.tone).toBe("success")
        expect(STATUS_META.failed.tone).toBe("danger")
    })

    it("pulses only while a run is in flight", () => {
        expect(STATUS_META.pending.pulse).toBe(true)
        expect(STATUS_META.completed.pulse).toBeUndefined()
    })

    // Un fallo tras un éxito previo es degradación, no caída dura.
    it("downgrades a post-success failure to a warning", () => {
        const meta = getStatusMeta({ status: "failed", wasSuccessful: true })
        expect(meta.tone).toBe("warning")
        expect(meta.label).toBe("Falló tras éxito")
    })

    it("keeps a first-time failure at danger", () => {
        expect(getStatusMeta({ status: "failed", wasSuccessful: false }).tone).toBe("danger")
    })

    // "No aplica" no es un estado: se pinta como ausencia (tone "none" => guion)
    // para que deje de competir con las filas que sí piden acción.
    it("renders 'no aplica' as absence rather than another pill", () => {
        expect(NOT_APPLICABLE_META.tone).toBe("none")
    })
})
