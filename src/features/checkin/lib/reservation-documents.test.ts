import { describe, expect, it } from "vitest"
import { selectReservationDocuments } from "./reservation-documents"

const doc = (uuid: string, type: string | null) => ({ uuid, type })
/** El caso reportado: cuatro contratos de la propiedad (uno por canal) y un reglamento. */
const PROPERTY_DOCS = [doc("ag-directo", "Agreement"), doc("ag-airbnb", "Agreement"), doc("ag-booking", "Agreement"), doc("ag-expedia", "Agreement"), doc("rules", "Rules")]

describe("selectReservationDocuments — solo el contrato de esta reserva", () => {
    it("deja el contrato elegido por el backend y conserva los documentos de otro tipo", () => {
        expect(selectReservationDocuments(PROPERTY_DOCS, "ag-airbnb").map((d) => d.uuid)).toEqual(["ag-airbnb", "rules"])
    })

    it("sin contrato elegido no oculta nada", () => {
        expect(selectReservationDocuments(PROPERTY_DOCS, null)).toHaveLength(5)
    })

    it("si el elegido no está en la lista, tampoco oculta nada", () => {
        expect(selectReservationDocuments(PROPERTY_DOCS, "otro")).toHaveLength(5)
    })

    it("sin tipo no puede saber cuáles son contratos: no filtra", () => {
        expect(selectReservationDocuments([doc("a", null), doc("b", null)], "a")).toHaveLength(2)
    })

    it("quita repetidos por uuid en cualquier caso", () => {
        expect(selectReservationDocuments([doc("a", "Agreement"), doc("a", "Agreement")], null)).toHaveLength(1)
    })
})
