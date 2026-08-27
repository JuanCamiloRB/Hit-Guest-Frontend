import { describe, expect, it } from "vitest"
import { readOverwrittenEdits, readReservationOrigin } from "./reservation-origin"
import { readReservationFieldErrors } from "./reservation-edit-errors"

describe("readReservationOrigin — el aviso PMS solo con un true explícito", () => {
    it("lee el shape real del contrato", () => {
        expect(readReservationOrigin({
            isImported: true,
            importSource: "calry",
            syncedAt: "2026-08-24T14:32:07+00:00",
        })).toEqual({
            isImported: true,
            originKnown: true,
            importSourceLabel: "Calry",
            syncedAt: "2026-08-24T14:32:07+00:00",
        })
    })

    it("ausente ≠ negado: solo un false explícito autoriza a afirmar «manual»", () => {
        expect(readReservationOrigin({ isImported: false }).originKnown).toBe(true)
        expect(readReservationOrigin({}).originKnown).toBe(false)
        expect(readReservationOrigin({ isImported: "true" }).originKnown).toBe(false)
    })

    it("una integración desconocida se muestra con su slug, nunca se oculta", () => {
        expect(readReservationOrigin({ isImported: true, importSource: "hostaway" }).importSourceLabel)
            .toBe("hostaway")
    })

    it("clave ausente o shape raro NO activa el modo importado (aviso, no gate)", () => {
        expect(readReservationOrigin({}).isImported).toBe(false)
        expect(readReservationOrigin(null).isImported).toBe(false)
        // `"true"` string no es un sí explícito: comparación exacta.
        expect(readReservationOrigin({ isImported: "true" }).isImported).toBe(false)
    })

    it("syncedAt null queda null: «no sabemos», nunca «sin sincronizar»", () => {
        expect(readReservationOrigin({ isImported: true, syncedAt: null }).syncedAt).toBeNull()
    })
})

describe("readOverwrittenEdits — tolerante por fila", () => {
    it("lee el shape real y traduce el field snake_case a etiqueta", () => {
        expect(readOverwrittenEdits({
            overwrittenEdits: [{
                field: "total_guests",
                previous: "5",
                incoming: "9",
                manuallyEditedAt: "2026-08-24T14:00:00+00:00",
                overwrittenAt: "2026-08-24T18:22:41+00:00",
                source: "calry",
            }],
        })).toEqual([{
            fieldLabel: "Huéspedes",
            previous: "5",
            incoming: "9",
            overwrittenAt: "2026-08-24T18:22:41+00:00",
            source: "calry",
        }])
    })

    it("un campo desconocido muestra su clave cruda en vez de perder la fila", () => {
        expect(readOverwrittenEdits({ overwrittenEdits: [{ field: "nuevo_campo", previous: "a", incoming: "b" }] })[0].fieldLabel)
            .toBe("nuevo_campo")
    })

    it("una fila malformada se descarta sin tirar la lista", () => {
        const edits = readOverwrittenEdits({
            overwrittenEdits: [
                "basura",
                { previous: "sin field" },
                { field: "currency", previous: "COP", incoming: "USD" },
            ],
        })
        expect(edits).toHaveLength(1)
        expect(edits[0].fieldLabel).toBe("Moneda")
    })

    it("sin la clave, o con extra raro, devuelve lista vacía", () => {
        expect(readOverwrittenEdits({})).toEqual([])
        expect(readOverwrittenEdits(null)).toEqual([])
        expect(readOverwrittenEdits({ overwrittenEdits: "nope" })).toEqual([])
    })
})

describe("readReservationFieldErrors — extrae el 422 sin recomponer mensajes", () => {
    it("devuelve campo y PRIMER mensaje localizado tal cual", () => {
        expect(readReservationFieldErrors({
            status: 422,
            errors: {
                externalId: ["A reservation with this same code already exists for this listing"],
                listingId: ["El alojamiento no tiene verificación de identidad activa", "otro"],
            },
        })).toEqual([
            { field: "externalId", message: "A reservation with this same code already exists for this listing" },
            { field: "listingId", message: "El alojamiento no tiene verificación de identidad activa" },
        ])
    })

    it("tolera errores sin `errors`, con arrays vacíos o shapes raros", () => {
        expect(readReservationFieldErrors(new Error("boom"))).toEqual([])
        expect(readReservationFieldErrors({ errors: { externalId: [] } })).toEqual([])
        expect(readReservationFieldErrors({ errors: ["plano"] })).toEqual([])
        expect(readReservationFieldErrors(null)).toEqual([])
    })
})
