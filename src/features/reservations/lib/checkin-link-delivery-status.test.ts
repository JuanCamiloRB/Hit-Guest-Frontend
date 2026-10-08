import { describe, expect, it } from "vitest"
import { hasUsablePhone, isOtaApplicable, mailStatusMeta, readCheckinLinkDelivery, whatsappStatusMeta } from "./checkin-link-delivery-status"

describe("OTA (contrato 2026-09-27 §13.5)", () => {
    it("lee envío y vía, y nunca el id interno del mensaje", () => {
        const result = readCheckinLinkDelivery({
            checkinLinkOtaSentAt: "2026-09-27T10:00:00Z",
            checkinLinkOtaVia: "kunas_pms",
            checkinLinkOtaMessageId: "SECRETO",
        })
        expect(result.ota).toEqual({ sentAt: "2026-09-27T10:00:00Z", via: "kunas_pms" })
        expect(JSON.stringify(result)).not.toContain("SECRETO")
        expect(readCheckinLinkDelivery({ checkin_link_ota_sent_at: "2026-09-27T10:00:00Z" }).ota?.via).toBeNull()
        expect(readCheckinLinkDelivery({}).ota).toBeNull()
    })

    it("aplica solo a reservas de Kunas o Calry; sin origen conocido no se afirma nada", () => {
        expect(isOtaApplicable({ originKnown: true, importSource: "kunas_pms" })).toBe(true)
        expect(isOtaApplicable({ originKnown: true, importSource: "calry" })).toBe(true)
        expect(isOtaApplicable({ originKnown: true, importSource: "ical" })).toBe(false)
        expect(isOtaApplicable({ originKnown: true, importSource: null })).toBe(false)
        expect(isOtaApplicable({ originKnown: false, importSource: null })).toBeNull()
    })
})

describe("hasUsablePhone", () => {
    it("acepta los formatos que el backend normaliza (7 a 15 dígitos)", () => {
        expect(hasUsablePhone("+573165258062")).toBe(true)
        expect(hasUsablePhone("316 525 8062")).toBe(true)
        expect(hasUsablePhone("(316) 525-8062")).toBe(true)
    })

    it("rechaza lo que el backend rechaza: solo prefijo, vacío, sin dígitos, demasiado largo", () => {
        expect(hasUsablePhone("+57")).toBe(false)
        expect(hasUsablePhone("")).toBe(false)
        expect(hasUsablePhone(undefined)).toBe(false)
        expect(hasUsablePhone("sin número")).toBe(false)
        expect(hasUsablePhone("1234567890123456")).toBe(false)
    })
})

describe("readCheckinLinkDelivery", () => {
    it("lee los dos canales del extra (camelCase, como llega)", () => {
        const result = readCheckinLinkDelivery({
            checkinLinkSentAt: "2026-09-18T14:32:00Z",
            checkinLinkSentTo: "doris@correo.com",
            mailDeliveryStatus: "delivered",
            checkinLinkWhatsappSentAt: "2026-09-18T14:32:05Z",
            checkinLinkWhatsappTo: "+573165258062",
            checkinLinkWhatsappMessageId: "wamid.XYZ",
            whatsappDeliveryStatus: "read",
            whatsappDeliveryStatusAt: "2026-09-18T14:35:00Z",
        })
        expect(result.email).toEqual({
            sentAt: "2026-09-18T14:32:00Z",
            to: "doris@correo.com",
            status: "delivered",
            reason: null,
            statusAt: null,
        })
        expect(result.whatsapp).toEqual({
            sentAt: "2026-09-18T14:32:05Z",
            to: "+573165258062",
            status: "read",
            reason: null,
            statusAt: "2026-09-18T14:35:00Z",
        })
        // El wamid es interno: ni siquiera se lee.
        expect(JSON.stringify(result)).not.toContain("wamid")
    })

    it("un canal por el que nunca salió es null; sin extra, ambos", () => {
        expect(readCheckinLinkDelivery({ checkinLinkSentAt: "2026-09-18T14:32:00Z" }).whatsapp).toBeNull()
        expect(readCheckinLinkDelivery(undefined)).toEqual({ email: null, whatsapp: null, ota: null })
        expect(readCheckinLinkDelivery([])).toEqual({ email: null, whatsapp: null, ota: null })
    })

    it("el destinatario de WhatsApp se lee también con el nombre alineado al de email", () => {
        expect(readCheckinLinkDelivery({
            checkinLinkWhatsappSentAt: "2026-09-18T14:32:05Z",
            checkinLinkWhatsappSentTo: "+573165258062",
        }).whatsapp?.to).toBe("+573165258062")
        expect(readCheckinLinkDelivery({
            checkin_link_whatsapp_sent_at: "2026-09-18T14:32:05Z",
            checkin_link_whatsapp_sent_to: "+573165258062",
        }).whatsapp?.to).toBe("+573165258062")
    })

    it("tolera snake_case", () => {
        const result = readCheckinLinkDelivery({
            checkin_link_whatsapp_sent_at: "2026-09-18T14:32:05Z",
            whatsapp_delivery_status: "failed",
            whatsapp_delivery_reason: "Número inválido",
        })
        expect(result.whatsapp?.status).toBe("failed")
        expect(result.whatsapp?.reason).toBe("Número inválido")
    })
})

describe("whatsappStatusMeta", () => {
    const base = { sentAt: "2026-09-18T14:32:05Z", to: "+57", status: null, reason: null, statusAt: null }

    it("sin estado o sent → Enviado; delivered/read → ok", () => {
        expect(whatsappStatusMeta(base).label).toBe("Enviado")
        expect(whatsappStatusMeta({ ...base, status: "sent" }).label).toBe("Enviado")
        expect(whatsappStatusMeta({ ...base, status: "delivered" })).toMatchObject({ label: "Entregado", tone: "success" })
        expect(whatsappStatusMeta({ ...base, status: "read" })).toMatchObject({ label: "Leído", tone: "success" })
    })

    it("failed dice el motivo y que no se cobró", () => {
        const meta = whatsappStatusMeta({ ...base, status: "failed", reason: "Número inválido" })
        expect(meta.tone).toBe("danger")
        expect(meta.detail).toBe("Número inválido · No se cobró este mensaje.")
    })

    it("un estado desconocido se muestra crudo, sin romper", () => {
        expect(whatsappStatusMeta({ ...base, status: "queued" })).toMatchObject({ label: "queued", tone: "idle" })
    })
})

describe("mailStatusMeta", () => {
    const base = { sentAt: "2026-09-18T14:32:00Z", to: "a@b.c", status: null, reason: null, statusAt: null }

    it("mapea los tres estados de Mailgun", () => {
        expect(mailStatusMeta(base).label).toBe("Enviado")
        expect(mailStatusMeta({ ...base, status: "delivered" }).tone).toBe("success")
        expect(mailStatusMeta({ ...base, status: "failed", reason: "Buzón lleno" }).detail).toBe("Buzón lleno")
        expect(mailStatusMeta({ ...base, status: "complained" }).tone).toBe("warning")
    })
})
