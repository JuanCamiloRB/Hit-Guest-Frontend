import { describe, it, expect, vi, beforeEach } from "vitest"

const patch = vi.fn()
const del = vi.fn()

vi.mock("@/lib/api-client", () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch: (...args: unknown[]) => patch(...args),
        delete: (...args: unknown[]) => del(...args),
    },
}))

import { integrationsService } from "./integrations-service"
import { INTEGRATION_STATUS } from "../types"

/**
 * Regression for `PATCH /api/guest/integrations/undefined → 404` (20260805).
 *
 * The integration is addressed by its ROOT-level alphanumeric token, not by a
 * numeric id — the published doc still shows `id`/`userId`, the live response
 * returns neither. A template literal interpolates a missing field as the
 * string "undefined", so the request looked valid and only failed at the
 * backend. These tests pin both halves: the right URL, and a loud failure when
 * the token is missing.
 */
const ROOT_TOKEN = "ERAw9p0F00VBCAJMy3XqCAlS7Yzpp9q9MbuNIgGz1ed1a2fb"

describe("integrationsService — addressing by root token", () => {
    beforeEach(() => {
        patch.mockReset().mockResolvedValue({})
        del.mockReset().mockResolvedValue(undefined)
    })

    it("activate PATCHes /integrations/{rootToken} with the active status", async () => {
        await integrationsService.activate(ROOT_TOKEN)

        expect(patch).toHaveBeenCalledWith(
            `/api/guest/integrations/${ROOT_TOKEN}`,
            { statusProviderId: INTEGRATION_STATUS.ACTIVE },
        )
    })

    it("deactivate PATCHes the same URL with the inactive status", async () => {
        await integrationsService.deactivate(ROOT_TOKEN)

        expect(patch).toHaveBeenCalledWith(
            `/api/guest/integrations/${ROOT_TOKEN}`,
            { statusProviderId: INTEGRATION_STATUS.INACTIVE },
        )
    })

    it("disconnect DELETEs /integrations/{rootToken}", async () => {
        await integrationsService.disconnect(ROOT_TOKEN)

        expect(del).toHaveBeenCalledWith(`/api/guest/integrations/${ROOT_TOKEN}`)
    })

    it.each([
        ["activate", () => integrationsService.activate(undefined as unknown as string)],
        ["deactivate", () => integrationsService.deactivate("")],
        ["disconnect", () => integrationsService.disconnect(undefined as unknown as string)],
    ])("%s throws instead of building /integrations/undefined", async (_name, call) => {
        await expect(call()).rejects.toThrow(/token raíz/i)
        expect(patch).not.toHaveBeenCalled()
        expect(del).not.toHaveBeenCalled()
    })
})
