import { describe, expect, it } from "vitest"
import { bindCatalogProviders, buildAutomationSlots } from "./automation-catalog"
import { AUTOMATION_DEFINITIONS } from "../data/automation-definitions"
import {
    AUTOMATION_STATUS,
    type PropertyAutomation,
    type Provider,
    type ProviderSetupSlot,
} from "../types/automation"

/**
 * Los fixtures replican el payload REAL de `GET /providers?country=CO`,
 * capturado contra guest.hit.tools el 2026-08-13. Si el backend cambia sus
 * `default_setup`, estos tests son los que tienen que romper — no la UI en
 * producción.
 */
function makeProvider(
    id: number,
    slug: string,
    setup: { enabled: boolean; slots?: ProviderSetupSlot[] },
    countries: string[] = ["ALL"],
): Provider {
    return {
        id,
        name: slug,
        description: null,
        parameters: {
            slug,
            internalUse: { path: slug },
            billing: { billable: false, unit_cost: 0 },
            applicable_countries: countries,
            default_setup: { enabled: setup.enabled, slots: setup.slots ?? [] },
        },
        order: 0,
        statusProviderId: 8,
    }
}

const slot = (over: Partial<ProviderSetupSlot>): ProviderSetupSlot => ({
    name: "Slot",
    order: 10,
    guest_type: "all",
    status_provider_id: AUTOMATION_STATUS.INACTIVE,
    ...over,
})

/** Lo que hoy devuelve Colombia, tal cual. */
const CO_PROVIDERS: Provider[] = [
    makeProvider(1005, "hitguest_signature", {
        enabled: true,
        slots: [slot({
            name: "Digital Signature for Contract",
            order: 10,
            guest_type: "main_guest",
            status_provider_id: AUTOMATION_STATUS.ACTIVE,
        })],
    }),
    makeProvider(1001, "ttlock", {
        enabled: true,
        slots: [slot({
            name: "Smart Lock Codes",
            order: 20,
            parameters: { username: "", password: "", client_id: "", client_secret: "", locks: [] },
        })],
    }),
    makeProvider(1003, "pdf_report", {
        enabled: true,
        slots: [slot({ name: "Guest Report PDF", order: 30, parameters: { recipients: [] } })],
    }),
    makeProvider(1, "tra_colombia", {
        enabled: true,
        slots: [slot({ name: "TRA Colombia", order: 40, parameters: { token: "", rnt: "" } })],
    }, ["CO"]),
    makeProvider(2, "sire_colombia", {
        enabled: true,
        slots: [
            slot({ name: "SIRE Colombia - Check-in", order: 50, parameters: { document_type: "", document_number: "", password: "", company_code: "" } }),
            slot({ name: "SIRE Colombia - Check-out", order: 51, parameters: { document_type: "", document_number: "", password: "", company_code: "" } }),
        ],
    }, ["CO"]),
    // Los dos que el backend NO ofrece como setup por defecto.
    makeProvider(1002, "tufirma", { enabled: false }),
    makeProvider(1006, "stripe_card_on_file", { enabled: false }),
]

function makeAutomation(overrides: Partial<PropertyAutomation> = {}): PropertyAutomation {
    return {
        uuid: "automation-1",
        propertyUuid: "property-1",
        providerId: null,
        name: "Automation",
        guestType: "all",
        executionOrder: 1,
        parameters: {},
        token: null,
        statusProviderId: AUTOMATION_STATUS.INACTIVE,
        deletedAt: null,
        isActive: false,
        ...overrides,
    }
}

const idsOf = (slots: { definition: { id: string } }[]) => slots.map((s) => s.definition.id)
const findSlot = (slots: ReturnType<typeof buildAutomationSlots>, id: string) =>
    slots.find((s) => s.definition.id === id)

describe("buildAutomationSlots", () => {
    it("ofrece lo que el backend declara para el país, en el orden que él dice", () => {
        // Los `order` reales son 10/20/30/40/50/51 — no el 1..8 que el frontend
        // tenía escrito a mano.
        const slots = buildAutomationSlots([], CO_PROVIDERS)

        expect(idsOf(slots)).toEqual([
            "digital-contract",
            "smart-lock-codes",
            "guest-report-pdf",
            "tra-colombia",
            "sire-colombia-checkin",
            "sire-colombia-checkout",
        ])
        expect(slots.map((s) => s.definition.order)).toEqual([10, 20, 30, 40, 50, 51])
        expect(slots.every((s) => s.automation === null)).toBe(true)
    })

    it("ignora los providers con default_setup deshabilitado", () => {
        // tufirma y stripe_card_on_file tienen `enabled: false`: existen para el
        // país pero el backend no los ofrece como fila a crear.
        const slots = buildAutomationSlots([], CO_PROVIDERS)

        expect(slots.some((s) => s.definition.providerOptions.some((o) => o.value === "stripe_card_on_file")))
            .toBe(false)
    })

    it("separa los dos slots de SIRE por su nombre, no por el provider", () => {
        // Un solo provider publica check-in (50) y check-out (51).
        const slots = buildAutomationSlots([], CO_PROVIDERS)

        expect(findSlot(slots, "sire-colombia-checkin")?.definition.order).toBe(50)
        expect(findSlot(slots, "sire-colombia-checkout")?.definition.order).toBe(51)
    })

    it("pide exactamente los campos que el slot declara", () => {
        // El caso que motivó esto: TTLock exige `client_id` y `client_secret`, y
        // el esquema del frontend no los tenía. El backend manda las claves.
        const slots = buildAutomationSlots([], CO_PROVIDERS)
        const ttlock = findSlot(slots, "smart-lock-codes")

        expect(ttlock?.definition.providerOptions[0].parametersSchema.map((f) => f.key))
            .toEqual(["username", "password", "client_id", "client_secret", "locks"])
    })

    it("no descarta una clave que el backend pida y no conozcamos", () => {
        // Descartarla haría que el PM guarde una configuración incompleta sin
        // enterarse — que es exactamente lo que pasaba con client_id.
        const provider = makeProvider(1, "tra_colombia", {
            enabled: true,
            slots: [slot({ name: "TRA Colombia", order: 40, parameters: { token: "", rnt: "", nuevo_campo: "" } })],
        }, ["CO"])

        const tra = findSlot(buildAutomationSlots([], [provider]), "tra-colombia")

        expect(tra?.definition.providerOptions[0].parametersSchema.map((f) => f.key))
            .toEqual(["token", "rnt", "nuevo_campo"])
    })

    it("no ofrece los reportes colombianos a un país que no los declara", () => {
        // La razón por la que se eliminó el seed fijo de 8 filas: sembraba TRA y
        // SIRE en propiedades de cualquier país.
        const panama = CO_PROVIDERS.filter((p) => !["tra_colombia", "sire_colombia"].includes(p.parameters.slug ?? ""))

        const ids = idsOf(buildAutomationSlots([], panama))

        expect(ids).not.toContain("tra-colombia")
        expect(ids).not.toContain("sire-colombia-checkin")
        expect(ids).toContain("smart-lock-codes")
    })

    it("no inventa nada cuando la lista de providers viene vacía", () => {
        // Vacía = no sabemos (fetch fallido), no "no hay nada disponible".
        const existing = makeAutomation({ guestType: "main_guest", executionOrder: 1 })

        const slots = buildAutomationSlots([existing], [])

        expect(slots).toHaveLength(1)
        expect(slots[0].automation).toBe(existing)
    })

    it("no duplica una definición que ya tiene fila en el backend", () => {
        const existing = makeAutomation({
            uuid: "tra-row",
            executionOrder: 40,
            providerId: 1,
            provider: makeProvider(1, "tra_colombia", { enabled: true }, ["CO"]),
        })

        const traSlots = buildAutomationSlots([existing], CO_PROVIDERS)
            .filter((s) => s.definition.id === "tra-colombia")

        expect(traSlots).toHaveLength(1)
        expect(traSlots[0].automation).toBe(existing)
    })

    it("nunca oculta una fila que el backend sí creó, aunque no tengamos definición", () => {
        const unknown = makeAutomation({
            uuid: "unknown-row",
            name: "Automatización futura",
            executionOrder: 99,
            providerId: 77,
            provider: makeProvider(77, "proveedor_futuro", { enabled: false }),
        })

        const slots = buildAutomationSlots([unknown], CO_PROVIDERS)

        expect(slots.some((s) => s.automation === unknown)).toBe(true)
    })

    it("manda el executionOrder de la fila real por encima del orden del slot", () => {
        // El backend puede haber numerado distinto en su momento; la fila existente
        // es el dato duro.
        const pdfFirst = makeAutomation({
            uuid: "pdf-row",
            executionOrder: 5,
            providerId: 1003,
            provider: makeProvider(1003, "pdf_report", { enabled: true }),
        })

        const ids = idsOf(buildAutomationSlots([pdfFirst], CO_PROVIDERS))

        expect(ids[0]).toBe("guest-report-pdf")
    })

    it("tolera guion y guion bajo en el slug del provider", () => {
        const hyphenated = makeProvider(1, "tra-colombia", {
            enabled: true,
            slots: [slot({ name: "TRA Colombia", order: 40, parameters: { token: "", rnt: "" } })],
        }, ["CO"])

        expect(idsOf(buildAutomationSlots([], [hyphenated]))).toEqual(["tra-colombia"])
    })
})

describe("bindCatalogProviders", () => {
    const identity = AUTOMATION_DEFINITIONS.find((item) => item.id === "identity-verification-main")!

    it("resuelve IDs desde el catálogo y no desde constantes del frontend", () => {
        const didit = makeProvider(701, "didit", { enabled: false })
        const textract = makeProvider(845, "textract", { enabled: false })

        const result = bindCatalogProviders(identity, null, [didit, textract], ["didit", "textract"])

        expect(result.providerOptions.map((option) => [option.value, option.providerId])).toEqual([
            ["didit", 701],
            ["textract", 845],
        ])
    })

    it("no ofrece una opción que el endpoint del país no devolvió", () => {
        const didit = makeProvider(701, "didit", { enabled: false })

        const result = bindCatalogProviders(identity, null, [didit], ["didit"])

        expect(result.providerOptions.map((option) => option.value)).toEqual(["didit"])
    })

    it("conserva el provider configurado aunque ya no esté activo en el catálogo", () => {
        const textract = makeProvider(845, "textract", { enabled: false })
        const automation = makeAutomation({
            guestType: "main_guest",
            providerId: 845,
            providerName: "textract",
            provider: textract,
        })

        const result = bindCatalogProviders(identity, automation, [textract], ["didit"])

        expect(result.providerOptions).toContainEqual(expect.objectContaining({ value: "textract", providerId: 845 }))
    })
})
