import { describe, expect, it } from "vitest"
import { isAgreementDocument, selectReservationDocuments } from "./reservation-documents"

const doc = (uuid: string, type: string | null, isContract?: boolean) => ({ uuid, type, ...(isContract != null ? { isContract } : {}) })
/** El caso reportado: cuatro contratos de la propiedad (uno por canal) y un reglamento. */
const PROPERTY_DOCS = [doc("ag-directo", "Agreement"), doc("ag-airbnb", "Agreement"), doc("ag-booking", "Agreement"), doc("ag-expedia", "Agreement"), doc("rules", "Rules")]
const uuids = (docs: { uuid: string }[]) => docs.map((d) => d.uuid)
const unsigned = { signedContractAvailable: false }

describe("selectReservationDocuments — solo el contrato de esta reserva (auditoría 2026-10-14)", () => {
    it("contrato elegido: solo ese contrato, y los documentos de otro tipo", () => {
        expect(uuids(selectReservationDocuments(PROPERTY_DOCS, { kind: "selected", uuid: "ag-airbnb" }, unsigned))).toEqual(["ag-airbnb", "rules"])
    })

    it("reserva sin contrato (sin contrato digital o solo garantía): ningún Agreement es suyo", () => {
        expect(uuids(selectReservationDocuments(PROPERTY_DOCS, { kind: "none" }, unsigned))).toEqual(["rules"])
    })

    it("no se pudo saber cuál es: no muestra contratos de otros canales", () => {
        expect(uuids(selectReservationDocuments(PROPERTY_DOCS, { kind: "unknown" }, unsigned))).toEqual(["rules"])
    })

    it("con el contrato firmado disponible no lista la copia sin firma", () => {
        expect(uuids(selectReservationDocuments(PROPERTY_DOCS, { kind: "selected", uuid: "ag-airbnb" }, { signedContractAvailable: true }))).toEqual(["rules"])
    })

    it("el contrato elegido que no está en la lista no trae a los demás", () => {
        expect(uuids(selectReservationDocuments(PROPERTY_DOCS, { kind: "selected", uuid: "otro" }, unsigned))).toEqual(["rules"])
    })

    it("quita repetidos por uuid", () => {
        expect(selectReservationDocuments([doc("rules", "Rules"), doc("rules", "Rules")], { kind: "none" }, unsigned)).toHaveLength(1)
    })
})

describe("isAgreementDocument", () => {
    it("reconoce el tipo Agreement y la marca isContract de backends nuevos", () => {
        expect(isAgreementDocument(doc("a", "Agreement"))).toBe(true)
        expect(isAgreementDocument(doc("b", "Otro", true))).toBe(true)
        expect(isAgreementDocument(doc("c", "Rules"))).toBe(false)
        expect(isAgreementDocument(doc("d", null))).toBe(false)
    })
})
