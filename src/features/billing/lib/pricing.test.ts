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

    it("lo que no es un rubro del tablero queda fuera, no adivinado", () => {
        expect(classifyRecord("pdf_report")).toBeNull()
        expect(classifyRecord(null, null)).toBeNull()
    })
})
