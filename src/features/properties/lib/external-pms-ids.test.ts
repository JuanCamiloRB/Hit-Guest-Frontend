import { describe, it, expect } from "vitest"
import {
    hasIncompleteExternalPmsId,
    normalizeExternalPmsIds,
    readExternalPmsIds,
    readExternalIdentifierServerErrors,
    mapExternalIdentifierErrorKey,
    sameExternalPmsIds,
    toExternalPmsIdsPayload,
} from "./external-pms-ids"

describe("normalizeExternalPmsIds", () => {
    it("reads the `pmsIdentifiers` shape a property response returns, keeping the row id", () => {
        // El `id` es lo que permite EDITAR la fila después (contrato 2026-08-23:
        // sin él, el mismo sourcePmsId devuelve 422 *_source_taken).
        expect(
            normalizeExternalPmsIds({
                pmsIdentifiers: [
                    { id: 3, sourcePmsId: 134, sourcePms: "KunasPMS", externalId: "KP-900" },
                ],
            }),
        ).toEqual([{ id: 3, sourcePmsId: 134, externalId: "KP-900" }])
    })

    it("reads the request-side `externalPmsIds` key too", () => {
        expect(
            normalizeExternalPmsIds({ externalPmsIds: [{ sourcePmsId: 100, externalId: "AIR-1" }] }),
        ).toEqual([{ sourcePmsId: 100, externalId: "AIR-1" }])
    })

    it("reads the snake_case `external_identifiers` shape", () => {
        expect(
            normalizeExternalPmsIds({
                external_identifiers: [{ source_pms_id: 101, external_id: "BK-77" }],
            }),
        ).toEqual([{ sourcePmsId: 101, externalId: "BK-77" }])
    })

    it("does not keep a garbage id — reenviarlo sería otro 422 (externalIdentifiers.N.id)", () => {
        expect(
            normalizeExternalPmsIds({
                pmsIdentifiers: [{ id: "abc", sourcePmsId: 134, externalId: "KP-900" }],
            }),
        ).toEqual([{ sourcePmsId: 134, externalId: "KP-900" }])
    })

    it("drops entries missing a source or an id instead of returning them half-built", () => {
        expect(
            normalizeExternalPmsIds({
                pmsIdentifiers: [
                    { sourcePmsId: 134, externalId: "KP-900" },
                    { sourcePmsId: 0, externalId: "orphan" },
                    { sourcePmsId: 100, externalId: "   " },
                ],
            }),
        ).toEqual([{ sourcePmsId: 134, externalId: "KP-900" }])
    })

    it("returns [] for null, primitives and unrecognized shapes", () => {
        expect(normalizeExternalPmsIds(null)).toEqual([])
        expect(normalizeExternalPmsIds("KP-900")).toEqual([])
        expect(normalizeExternalPmsIds({ pmsIdentifiers: "nope" })).toEqual([])
        expect(normalizeExternalPmsIds({})).toEqual([])
    })
})

describe("readExternalPmsIds — vacío afirmado ≠ clave ausente", () => {
    it("clave presente y vacía devuelve [] (la respuesta AFIRMA que no hay filas)", () => {
        expect(readExternalPmsIds({ pmsIdentifiers: [] })).toEqual([])
    })

    it("clave ausente devuelve null: la rehidratación no debe pisar estado real", () => {
        expect(readExternalPmsIds({})).toBeNull()
        expect(readExternalPmsIds(null)).toBeNull()
        expect(readExternalPmsIds({ pmsIdentifiers: "nope" })).toBeNull()
    })
})

describe("hasIncompleteExternalPmsId", () => {
    it("flags the state a freshly added row starts in", () => {
        expect(hasIncompleteExternalPmsId([{ sourcePmsId: 0, externalId: "" }])).toBe(true)
        expect(hasIncompleteExternalPmsId([{ sourcePmsId: 134, externalId: "  " }])).toBe(true)
        expect(hasIncompleteExternalPmsId([{ sourcePmsId: 0, externalId: "KP-900" }])).toBe(true)
    })

    it("passes complete rows and the empty list", () => {
        expect(hasIncompleteExternalPmsId([{ sourcePmsId: 134, externalId: "KP-900" }])).toBe(false)
        expect(hasIncompleteExternalPmsId([])).toBe(false)
        expect(hasIncompleteExternalPmsId(undefined)).toBe(false)
    })
})

describe("toExternalPmsIdsPayload", () => {
    it("trims ids and drops incomplete rows", () => {
        expect(
            toExternalPmsIdsPayload([
                { sourcePmsId: 134, externalId: "  KP-900 " },
                { sourcePmsId: 0, externalId: "orphan" },
            ]),
        ).toEqual([{ sourcePmsId: 134, externalId: "KP-900" }])
    })

    it("reenvía el id de las filas existentes y omite la clave en las nuevas", () => {
        expect(
            toExternalPmsIdsPayload([
                { id: 42, sourcePmsId: 100, externalId: "XYZ789" },
                { sourcePmsId: 134, externalId: "KP-900" },
            ]),
        ).toEqual([
            { id: 42, sourcePmsId: 100, externalId: "XYZ789" },
            { sourcePmsId: 134, externalId: "KP-900" },
        ])
    })

    it("returns an empty array — not undefined — so removing the last mapping is expressible", () => {
        expect(toExternalPmsIdsPayload([])).toEqual([])
        expect(toExternalPmsIdsPayload(undefined)).toEqual([])
    })
})

describe("sameExternalPmsIds — la condición del dirty-gating", () => {
    it("mismo contenido (incluso reordenado o sin recortar) no es un cambio", () => {
        expect(sameExternalPmsIds(
            [{ id: 1, sourcePmsId: 100, externalId: "A" }, { sourcePmsId: 134, externalId: "K" }],
            [{ sourcePmsId: 134, externalId: " K " }, { id: 1, sourcePmsId: 100, externalId: "A" }],
        )).toBe(true)
        expect(sameExternalPmsIds([], undefined)).toBe(true)
    })

    it("cambiar un valor, quitar una fila o perder el id sí es un cambio", () => {
        const base = [{ id: 1, sourcePmsId: 100, externalId: "A" }]
        expect(sameExternalPmsIds(base, [{ id: 1, sourcePmsId: 100, externalId: "B" }])).toBe(false)
        expect(sameExternalPmsIds(base, [])).toBe(false)
        expect(sameExternalPmsIds(base, [{ sourcePmsId: 100, externalId: "A" }])).toBe(false)
    })

    it("una fila incompleta recién agregada todavía no cuenta como cambio", () => {
        // El payload la descartaría igual: no hay nada nuevo que declarar.
        expect(sameExternalPmsIds([], [{ sourcePmsId: 0, externalId: "" }])).toBe(true)
    })
})

describe("errores del backend — externalIdentifiers.N.campo (tercer nombre del mismo dato)", () => {
    it("mapea la clave a fila y campo", () => {
        expect(mapExternalIdentifierErrorKey("externalIdentifiers.0.sourcePmsId"))
            .toEqual({ index: 0, field: "sourcePmsId" })
        expect(mapExternalIdentifierErrorKey("externalIdentifiers.12.id"))
            .toEqual({ index: 12, field: "id" })
        expect(mapExternalIdentifierErrorKey("name")).toBeNull()
        expect(mapExternalIdentifierErrorKey("externalPmsIds.0.externalId")).toBeNull()
    })

    it("extrae del cuerpo 422 solo los errores de identificadores, con su mensaje tal cual", () => {
        expect(readExternalIdentifierServerErrors({
            "externalIdentifiers.0.sourcePmsId": ["Esta propiedad ya tiene una integración activa con este PMS"],
            "externalIdentifiers.1.externalId": ["The externalIdentifiers.1.externalId field is required."],
            "name": ["required"],
        })).toEqual([
            { index: 0, field: "sourcePmsId", message: "Esta propiedad ya tiene una integración activa con este PMS" },
            { index: 1, field: "externalId", message: "The externalIdentifiers.1.externalId field is required." },
        ])
    })

    it("tolera shapes de error inesperados sin lanzar", () => {
        expect(readExternalIdentifierServerErrors(undefined)).toEqual([])
        expect(readExternalIdentifierServerErrors(["mensaje suelto"])).toEqual([])
        expect(readExternalIdentifierServerErrors({ "externalIdentifiers.0.externalId": [] })).toEqual([])
    })
})
