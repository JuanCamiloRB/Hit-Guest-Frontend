import { describe, expect, it } from "vitest"
import { classifyRecord } from "./pricing"

describe("classifyRecord", () => {
    it("textract es VERIFICACIÓN, no TRA (el substring 'tra' lo mandaba a la columna equivocada)", () => {
        expect(classifyRecord("textract")).toBe("checkin")
        expect(classifyRecord("textract_ocr")).toBe("checkin")
    })

    it("la firma nativa clasifica como contrato: 'hitguest_signature' no contiene 'firma'", () => {
        expect(classifyRecord("hitguest_signature")).toBe("contract")
        expect(classifyRecord(null, "Digital Signature for Contract")).toBe("contract")
        expect(classifyRecord("tufirma")).toBe("contract")
    })

    it("los slugs reales del catálogo caen donde el tablero los muestra", () => {
        expect(classifyRecord("didit")).toBe("checkin")
        expect(classifyRecord("tra_colombia")).toBe("tra")
        expect(classifyRecord("sire_colombia")).toBe("sire")
        expect(classifyRecord("ttlock")).toBe("access")
    })

    it("el envío del link tiene su rubro, y va antes que identidad: su nombre matchea 'check-in'", () => {
        expect(classifyRecord("whatsapp_checkin_link", "Check-in Link Delivery", "whatsapp")).toBe("whatsapp")
        expect(classifyRecord("whatsapp-checkin-link", null, "whatsapp")).toBe("whatsapp")
    })

    it("WhatsApp y OTA comparten slug: el canal decide la columna (§13.6)", () => {
        expect(classifyRecord("whatsapp_checkin_link", "Check-in Link Delivery", "ota_inbox")).toBe("otaInbox")
        expect(classifyRecord("ota_inbox_checkin_link")).toBe("otaInbox")
    })

    it("un registro histórico sin canal queda como WhatsApp (antes del addendum no había otro)", () => {
        expect(classifyRecord("whatsapp_checkin_link")).toBe("whatsapp")
        expect(classifyRecord("whatsapp_checkin_link", "Check-in Link Delivery", null)).toBe("whatsapp")
    })

    it("otro provider de WhatsApp no es el link de check-in", () => {
        expect(classifyRecord("whatsapp_marketing")).toBeNull()
        expect(classifyRecord("whatsapp_support", "Soporte por WhatsApp")).toBeNull()
    })

    it("lo que no es un rubro del tablero queda fuera, no adivinado", () => {
        expect(classifyRecord("pdf_report")).toBeNull()
        expect(classifyRecord(null, null)).toBeNull()
    })
})
