import { describe, it, expect } from "vitest"
import { detectMode, findLockstepGaps, planDocumentSync } from "./contract-routing-sync"
import type { PropertyDocument } from "../types/document"
import type { ContractRoutingParameters } from "../types/contract-routing"

/**
 * Regression suite for the contract-routing "lockstep" sync (backend plan
 * §1.4, §3.5) — the module where this feature's real complexity lives.
 *
 * These 10 scenarios were originally verified with throwaway Node scripts in
 * the scratchpad during development (run once, deleted). This is the same
 * logic, ported to a persisted suite so a future change to
 * `contract-routing-sync.ts` can't silently break a transition it already
 * got right.
 */

/** Minimal valid PropertyDocument — only reservationSourceId/content/uuid vary per test. */
function makeDoc(overrides: Partial<PropertyDocument> & Pick<PropertyDocument, "uuid">): PropertyDocument {
    return {
        propertyUuid: "prop-1",
        documentType: { id: 92, name: "Agreement", parameters: { shortcodes: [] } },
        content: "",
        statusRecord: { id: 6, name: "Active" },
        reservationSourceId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: null,
        ...overrides,
    }
}

describe("detectMode", () => {
    it("returns null for a property with no Agreement documents yet", () => {
        expect(detectMode([])).toBeNull()
    })

    it("returns all_sources for a single null-channel document", () => {
        expect(detectMode([makeDoc({ uuid: "d1", reservationSourceId: null })])).toBe("all_sources")
    })

    it("returns per_source for documents each bound to a channel", () => {
        const docs = [
            makeDoc({ uuid: "d1", reservationSourceId: 22 }),
            makeDoc({ uuid: "d2", reservationSourceId: 23 }),
        ]
        expect(detectMode(docs)).toBe("per_source")
    })
})

describe("planDocumentSync", () => {
    it("all_sources: a text change updates the existing doc, nothing else", () => {
        const current = [makeDoc({ uuid: "d1", reservationSourceId: null, content: "old" })]
        const desired: ContractRoutingParameters = {
            contract_mode: "all_sources",
            by_source: { all: { contract_type: "agreement_only", provider_slug: "tufirma" } },
        }
        const plan = planDocumentSync(current, desired, { all: "new" })
        expect(plan.updates).toEqual([{ documentUuid: "d1", content: "new" }])
        expect(plan.creates).toHaveLength(0)
        expect(plan.deletes).toHaveLength(0)
    })

    it("all_sources → per_source: converts the null doc into the first channel, creates the rest", () => {
        const current = [makeDoc({ uuid: "d1", reservationSourceId: null, content: "generic" })]
        const desired: ContractRoutingParameters = {
            contract_mode: "per_source",
            by_source: {
                "22": { contract_type: "agreement_only", provider_slug: "hitguest_signature" },
                "23": { contract_type: "agreement_and_guarantee", provider_slug: "tufirma" },
            },
        }
        const plan = planDocumentSync(current, desired, { "22": "airbnb", "23": "booking" })
        expect(plan.updates).toEqual([{ documentUuid: "d1", reservationSourceId: 22, content: "airbnb" }])
        expect(plan.creates).toEqual([{ reservationSourceId: 23, content: "booking" }])
        expect(plan.deletes).toHaveLength(0)
    })

    it("per_source → all_sources: converts one leftover doc, deletes the other", () => {
        const current = [
            makeDoc({ uuid: "d22", reservationSourceId: 22, content: "airbnb text" }),
            makeDoc({ uuid: "d23", reservationSourceId: 23, content: "booking text" }),
        ]
        const desired: ContractRoutingParameters = {
            contract_mode: "all_sources",
            by_source: { all: { contract_type: "agreement_only", provider_slug: "tufirma" } },
        }
        const plan = planDocumentSync(current, desired, { all: "unified" })
        expect(plan.updates).toEqual([{ documentUuid: "d22", reservationSourceId: null, content: "unified" }])
        expect(plan.deletes).toEqual(["d23"])
        expect(plan.creates).toHaveLength(0)
    })

    it("a channel switching to guarantee_only leaves its leftover agreement doc untouched", () => {
        const current = [makeDoc({ uuid: "d22", reservationSourceId: 22, content: "old airbnb text" })]
        const desired: ContractRoutingParameters = {
            contract_mode: "per_source",
            by_source: { "22": { contract_type: "guarantee_only", provider_slug: "tufirma" } },
        }
        const plan = planDocumentSync(current, desired, {})
        expect(plan.creates).toHaveLength(0)
        expect(plan.updates).toHaveLength(0)
        expect(plan.deletes).toHaveLength(0)
    })

    it("all_sources/guarantee_only deletes a stray per-source doc, creates nothing", () => {
        const current = [makeDoc({ uuid: "d22", reservationSourceId: 22, content: "stray" })]
        const desired: ContractRoutingParameters = {
            contract_mode: "all_sources",
            by_source: { all: { contract_type: "guarantee_only", provider_slug: "tufirma" } },
        }
        const plan = planDocumentSync(current, desired, {})
        expect(plan.deletes).toEqual(["d22"])
        expect(plan.creates).toHaveLength(0)
        expect(plan.updates).toHaveLength(0)
    })

    it("per_source with a leftover null doc and no channel needing text deletes the null doc", () => {
        const current = [makeDoc({ uuid: "doc-all", reservationSourceId: null, content: "old generic text" })]
        const desired: ContractRoutingParameters = {
            contract_mode: "per_source",
            by_source: {
                "22": { contract_type: "guarantee_only", provider_slug: "tufirma" },
                "23": { contract_type: "guarantee_only", provider_slug: "tufirma" },
            },
        }
        const plan = planDocumentSync(current, desired, {})
        expect(plan.deletes).toEqual(["doc-all"])
        expect(plan.creates).toHaveLength(0)
        expect(plan.updates).toHaveLength(0)
    })

    it("per_source on a brand new property creates every needed channel fresh", () => {
        const desired: ContractRoutingParameters = {
            contract_mode: "per_source",
            by_source: {
                "22": { contract_type: "agreement_only", provider_slug: "hitguest_signature" },
                "23": { contract_type: "agreement_and_guarantee", provider_slug: "tufirma" },
            },
        }
        const plan = planDocumentSync([], desired, { "22": "airbnb text", "23": "booking text" })
        expect(plan.updates).toHaveLength(0)
        expect(plan.deletes).toHaveLength(0)
        expect(plan.creates).toHaveLength(2)
        expect(plan.creates).toContainEqual({ reservationSourceId: 22, content: "airbnb text" })
        expect(plan.creates).toContainEqual({ reservationSourceId: 23, content: "booking text" })
    })
})

describe("findLockstepGaps", () => {
    it("flags a channel that needs agreement text but has none typed", () => {
        const desired: ContractRoutingParameters = {
            contract_mode: "per_source",
            by_source: { "22": { contract_type: "agreement_only", provider_slug: "tufirma" } },
        }
        expect(findLockstepGaps(desired, {})).toEqual(["22"])
    })

    it("does not flag a channel once text is typed", () => {
        const desired: ContractRoutingParameters = {
            contract_mode: "per_source",
            by_source: { "22": { contract_type: "agreement_only", provider_slug: "tufirma" } },
        }
        expect(findLockstepGaps(desired, { "22": "some text" })).toEqual([])
    })

    it("never flags a guarantee_only channel — it has no agreement text to give", () => {
        const desired: ContractRoutingParameters = {
            contract_mode: "all_sources",
            by_source: { all: { contract_type: "guarantee_only", provider_slug: "tufirma" } },
        }
        expect(findLockstepGaps(desired, {})).toEqual([])
    })
})
