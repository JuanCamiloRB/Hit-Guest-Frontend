import { describe, expect, it } from "vitest"
import { SKIPPED_REASON_COPY, chargeLabel, describePayload } from "./AutomationHistoryModal"

describe("describePayload", () => {
    it("explica el skip documentado de PDF", () => {
        expect(describePayload({ skipped: true, reason: "no_recipients" }))
            .toBe("No se envió: no hay destinatarios configurados.")
    })

    it("traduce los nueve motivos documentados de ejecución omitida", () => {
        const reasons = [
            "no_recipients",
            "no_whatsapp_phone",
            "whatsapp_not_configured",
            "not_imported_from_pms",
            "pms_integration_unavailable",
            "kunas_messaging_not_configured",
            "calry_not_configured",
            "no_ota_thread",
            "already_posted",
        ]
        expect(Object.keys(SKIPPED_REASON_COPY).sort()).toEqual([...reasons].sort())
        for (const reason of reasons) {
            const text = describePayload({ skipped: true, reason })
            expect(text).toBe(SKIPPED_REASON_COPY[reason])
            expect(text).not.toContain(reason)
        }
    })

    it("un motivo desconocido cae al texto genérico, sin el código crudo", () => {
        expect(describePayload({ skipped: true, reason: "rate_limited_by_meta" })).toBe("La ejecución fue omitida.")
        expect(describePayload({ skipped: true, reason: "toString" })).toBe("La ejecución fue omitida.")
    })

    it("no muestra claves ni valores crudos desconocidos al PM", () => {
        const text = describePayload({ access_token: "SECRETO", external_response: { document: "PII" } })

        expect(text).toBe("—")
        expect(text).not.toContain("SECRETO")
        expect(text).not.toContain("PII")
    })
})

describe("chargeLabel", () => {
    const base = { billable: true, unitCost: null, responsePayload: null }

    it("un registro omitido es «Sin cargo» aunque llegue billable", () => {
        expect(chargeLabel({ ...base, responsePayload: { skipped: true, reason: "no_recipients" } }))
            .toBe("Sin cargo")
    })

    it("billable con tarifa 0 no se lee como «0.0000»", () => {
        expect(chargeLabel({ ...base, unitCost: "0.0000" })).toBe("Facturable · sin costo por ahora")
    })

    it("billable con tarifa la muestra; no billable es «Sin cargo»", () => {
        expect(chargeLabel({ ...base, unitCost: "0.0625" })).toBe("Facturable · 0.0625")
        expect(chargeLabel({ ...base, billable: false })).toBe("Sin cargo")
    })
})
