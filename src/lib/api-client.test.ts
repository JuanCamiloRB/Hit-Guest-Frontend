import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    clearSession: vi.fn(),
    token: "pm-session-token" as string | null,
}))

vi.mock("@/lib/store/auth-store", () => ({
    useAuthStore: {
        getState: () => ({
            user: mocks.token ? { token: mocks.token } : null,
            clearSession: mocks.clearSession,
        }),
    },
}))

vi.mock("@/store/useLanguageStore", () => ({
    useLanguageStore: { getState: () => ({ language: "es" }) },
}))

import { request } from "./api-client"

describe("apiClient auth semantics", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.token = "pm-session-token"
        window.history.pushState({}, "", "/login")
    })

    it("401 invalida la sesión sin depender del texto del backend", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "cualquier mensaje localizado",
        }), { status: 401, headers: { "Content-Type": "application/json" } })))

        await expect(request("/api/guest/property-automations")).rejects.toMatchObject({ status: 401 })
        expect(mocks.clearSession).toHaveBeenCalledOnce()
    })

    it("403 de policy conserva la sesión del PM", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "You do not have permission to perform this action.",
        }), { status: 403, headers: { "Content-Type": "application/json" } })))

        await expect(request("/api/guest/property-automations")).rejects.toMatchObject({ status: 403 })
        expect(mocks.clearSession).not.toHaveBeenCalled()
    })
})
