import { describe, it, expect } from "vitest"
import {
    hasIncompleteExternalPmsId,
    normalizeExternalPmsIds,
    toExternalPmsIdsPayload,
} from "./external-pms-ids"

describe("normalizeExternalPmsIds", () => {
    it("reads the `pmsIdentifiers` shape a property response returns", () => {
        expect(
            normalizeExternalPmsIds({
                pmsIdentifiers: [
                    { id: 3, sourcePmsId: 134, sourcePms: "KunasPMS", externalId: "KP-900" },
                ],
            }),
        ).toEqual([{ sourcePmsId: 134, externalId: "KP-900" }])
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

    it("returns an empty array — not undefined — so removing the last mapping is expressible", () => {
        expect(toExternalPmsIdsPayload([])).toEqual([])
        expect(toExternalPmsIdsPayload(undefined)).toEqual([])
    })
})
