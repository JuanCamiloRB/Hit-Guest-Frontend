import { afterEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/lib/api-client"
import { automationService } from "./automation-service"

describe("automationService.listUsageRecords", () => {
    afterEach(() => vi.restoreAllMocks())

    it("normaliza el recurso y descarta payload/body crudos de soporte", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([{
            id: 9,
            status: "failed",
            triggered_by: "on_physical_checkout",
            automation_uuid: "automation-1",
            automation_name: "SIRE salida",
            provider_slug: "sire_colombia",
            guest_uuid: "guest-1",
            billable: true,
            unit_cost: "0.00",
            last_error: {
                message: "Falló",
                http_status: 500,
                http_body: "TOKEN=SECRETO",
            },
            response_payload: {
                skipped: true,
                reason: "no_recipients",
                access_token: "SECRETO",
            },
            created_at: "2026-08-13 10:00:00",
            updated_at: "2026-08-13 10:00:01",
        }])

        const [record] = await automationService.listUsageRecords("reservation-1")

        expect(record.triggeredBy).toBe("on_physical_checkout")
        expect(record.lastError).toEqual({ message: "Falló", httpStatus: 500, httpBody: null })
        expect(record.responsePayload).toEqual({ skipped: true, reason: "no_recipients" })
        expect(JSON.stringify(record)).not.toContain("SECRETO")
    })
})
