import { describe, it, expect } from "vitest"
import { readAutomationGuests } from "./automation-service"

describe("readAutomationGuests — `guests[]` de automation-status (contrato 2026-10-27 §2.5)", () => {
    it("lee cada huésped con sus permisos del backend", () => {
        expect(readAutomationGuests([{
            guestUuid: "g-1", name: "Ana Pérez", isMainGuest: true, checkinCompleted: true, status: "failed",
            usageRecordId: 123, lastError: "timeout", lastRunAt: "2026-10-27 09:00:00", canDispatch: false, canRedispatch: true,
        }])).toEqual([{
            guestUuid: "g-1", name: "Ana Pérez", isMainGuest: true, checkinCompleted: true, status: "failed",
            usageRecordId: 123, lastError: "timeout", lastRunAt: "2026-10-27 09:00:00", canDispatch: false, canRedispatch: true,
        }])
    })

    it("`skipped` se conserva; un estado desconocido no habilita nada", () => {
        expect(readAutomationGuests([{ guestUuid: "g-1", status: "skipped" }])[0].status).toBe("skipped")
        const odd = readAutomationGuests([{ guestUuid: "g-2", status: "rarísimo" }])[0]
        expect(odd).toMatchObject({ status: "not_started", canDispatch: false, canRedispatch: false })
    })

    it("sin guestUuid no sirve para despachar: se descarta; sin lista, vacío", () => {
        expect(readAutomationGuests([{ name: "Sin uuid" }])).toEqual([])
        expect(readAutomationGuests(undefined)).toEqual([])
    })

    it("lee también snake_case", () => {
        expect(readAutomationGuests([{ guest_uuid: "g-1", can_dispatch: true, usage_record_id: 5 }])[0])
            .toMatchObject({ guestUuid: "g-1", canDispatch: true, usageRecordId: 5 })
    })
})
