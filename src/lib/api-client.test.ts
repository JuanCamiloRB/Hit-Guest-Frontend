import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    clearSession: vi.fn(),
    endImpersonation: vi.fn(),
    token: "pm-session-token" as string | null,
    actor: null as { token: string } | null,
}))

vi.mock("@/lib/store/auth-store", () => ({
    useAuthStore: {
        getState: () => ({
            user: mocks.token ? { token: mocks.token } : null,
            actor: mocks.actor,
            clearSession: mocks.clearSession,
            endImpersonation: mocks.endImpersonation,
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

describe("apiClient — un 202 no es un éxito con datos", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.token = "pm-session-token"
    })

    it("con rejectNotReady, un 202 se rechaza como ApiError(202) con el mensaje del backend", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "Sincronización en progreso",
        }), { status: 202, headers: { "Content-Type": "application/json" } })))

        await expect(request("/api/guest/reservations", { rejectNotReady: true }))
            .rejects.toMatchObject({ status: 202, message: "Sincronización en progreso" })
        expect(mocks.clearSession).not.toHaveBeenCalled()
    })

    it("sin la opción, un 202 sigue resolviendo (los POST que encolan dependen de eso)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: { queued: true },
        }), { status: 202, headers: { "Content-Type": "application/json" } })))

        await expect(request("/api/guest/ical/feeds/x/sync")).resolves.toEqual({ queued: true })
    })
})

describe("apiClient — 401 dentro de la cuenta de otro usuario", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.token = "t-suplantado"
        mocks.actor = { token: "t-superusuario" }
        window.history.pushState({}, "", "/dashboard")
    })

    it("sale de la cuenta ajena y NUNCA cierra la sesión del superusuario", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "Unauthenticated.",
        }), { status: 401, headers: { "Content-Type": "application/json" } })))

        await expect(request("/api/guest/reservations")).rejects.toMatchObject({ status: 401 })
        expect(mocks.endImpersonation).toHaveBeenCalledOnce()
        expect(mocks.clearSession).not.toHaveBeenCalled()
        mocks.actor = null
    })
})
