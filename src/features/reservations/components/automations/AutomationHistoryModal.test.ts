import { describe, expect, it } from "vitest"
import { describePayload } from "./AutomationHistoryModal"

describe("describePayload", () => {
    it("explica el skip documentado de PDF", () => {
        expect(describePayload({ skipped: true, reason: "no_recipients" }))
            .toBe("No se envió: no hay destinatarios configurados.")
    })

    it("no muestra claves ni valores crudos desconocidos al PM", () => {
        const text = describePayload({ access_token: "SECRETO", external_response: { document: "PII" } })

        expect(text).toBe("—")
        expect(text).not.toContain("SECRETO")
        expect(text).not.toContain("PII")
    })
})
