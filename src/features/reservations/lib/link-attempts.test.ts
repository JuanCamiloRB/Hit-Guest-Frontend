import { describe, expect, it } from "vitest"
import type { AutomationUsageRecord } from "@/features/properties/types/automation"
import { attemptLines, latestLinkAttempts } from "./link-attempts"
import { readCheckinLinkDelivery } from "./checkin-link-delivery-status"
import { skippedReasonShort } from "./skipped-reasons"

const record = (overrides: Partial<AutomationUsageRecord>): AutomationUsageRecord => ({
    id: 1, status: "completed", triggeredBy: null, automationUuid: "link-1", automationName: "Check-in Link Delivery",
    providerSlug: "whatsapp_checkin_link", guestUuid: null, billable: false, unitCost: null, lastError: null,
    responsePayload: null, channel: null, createdAt: "2026-11-18 10:42:00", updatedAt: "2026-11-18 10:42:00",
    ...overrides,
})

describe("latestLinkAttempts — el intento más reciente por canal, del historial", () => {
    it("toma el primero por canal (llegan del más nuevo al más viejo); sin `channel` es WhatsApp", () => {
        const attempts = latestLinkAttempts([
            record({ id: 3, channel: "ota_inbox", responsePayload: { skipped: true, reason: "no_ota_thread" } }),
            record({ id: 2, channel: null, responsePayload: { skipped: true, reason: "no_whatsapp_phone" } }),
            record({ id: 1, channel: "whatsapp", status: "completed" }),
            record({ id: 0, providerSlug: "tra_colombia", channel: null, status: "failed" }),
        ])
        expect(attempts.ota_inbox).toMatchObject({ outcome: "skipped", reason: "la reserva no tiene conversación en la OTA" })
        expect(attempts.whatsapp).toMatchObject({ outcome: "skipped", reason: "la reserva no tiene un teléfono utilizable" })
    })

    it("un fallo trae el error en palabras; un código suelto no se muestra", () => {
        const withText = latestLinkAttempts([record({ status: "failed", lastError: { message: "El número no existe en WhatsApp", httpStatus: null, httpBody: null } })])
        expect(withText.whatsapp).toMatchObject({ outcome: "failed", reason: "El número no existe en WhatsApp" })
        const withCode = latestLinkAttempts([record({ status: "failed", lastError: "meta_131026" })])
        expect(withCode.whatsapp!.reason).toBeNull()
    })
})

describe("attemptLines — lo que el historial agrega al detalle", () => {
    it("solo los canales que la reserva no trae; saltado = «no se envió» con el motivo, sin color de fallo", () => {
        const delivery = readCheckinLinkDelivery({ checkinLinkSentAt: "2026-11-18T15:42:00Z", checkinLinkOtaSentAt: "2026-11-18T15:42:00Z" })
        const lines = attemptLines(latestLinkAttempts([
            record({ channel: "whatsapp", responsePayload: { skipped: true, reason: "no_whatsapp_phone" } }),
            record({ channel: "ota_inbox", status: "completed" }),
        ]), delivery)
        // La OTA ya viene en la reserva (con su hora): el historial no la repite.
        expect(lines).toEqual([{ state: "none", text: "WhatsApp · no se envió · 18 nov, 10:42: la reserva no tiene un teléfono utilizable" }])
    })

    it("un WhatsApp que falló y la reserva no registró: rojo con el motivo", () => {
        const lines = attemptLines(latestLinkAttempts([record({ channel: "whatsapp", status: "failed", lastError: { message: "Plantilla rechazada por Meta", httpStatus: null, httpBody: null } })]), readCheckinLinkDelivery({}))
        expect(lines).toEqual([{ state: "failed", text: "WhatsApp · falló · 18 nov, 10:42: Plantilla rechazada por Meta" }])
    })

    it("un motivo de salto desconocido no se inventa: «motivo no informado»", () => {
        const lines = attemptLines(latestLinkAttempts([record({ channel: "ota_inbox", responsePayload: { skipped: true, reason: "algo_nuevo" } })]), readCheckinLinkDelivery({}))
        expect(lines[0].text).toBe("Mensaje en la OTA · no se publicó · 18 nov, 10:42 (motivo no informado)")
    })

    it("skippedReasonShort quita el «No se envió por …:» del historial y el punto final", () => {
        expect(skippedReasonShort("already_posted")).toBe("el mensaje ya estaba en la OTA")
        expect(skippedReasonShort("desconocido")).toBeNull()
        expect(skippedReasonShort(null)).toBeNull()
    })
})
