import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({
    apiClient: { post: mocks.post },
    handleSessionExpired: vi.fn(),
}))

import { authService, mapUserResponse } from "./auth-service"

beforeEach(() => {
    vi.clearAllMocks()
    mocks.post.mockResolvedValue({})
})

describe("authService.resendOtp", () => {
    it("mantiene el endpoint, auth y payload documentados por backend", async () => {
        await authService.resendOtp("  Persona@Example.COM ")

        expect(mocks.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/auth\/resend-otp$/),
            { email: "persona@example.com" },
            { appAuth: true },
        )
    })
})

describe("mapUserResponse — isPrincipal sin inventar (auditoría 2026-10-14)", () => {
    it("sin la clave vieja, isPrincipal sale de isAccountOwner (UserResource)", () => {
        expect(mapUserResponse({ uuid: "u-1", isAccountOwner: true }, "t").isPrincipal).toBe(true)
        // Un secundario ya no se pinta como dueño: antes un ausente valía true.
        expect(mapUserResponse({ uuid: "u-2", isAccountOwner: false }, "t").isPrincipal).toBe(false)
        expect(mapUserResponse({ uuid: "u-3" }, "t").isPrincipal).toBe(false)
    })

    it("si el backend manda isPrincipal explícito, manda ese", () => {
        expect(mapUserResponse({ uuid: "u-1", isPrincipal: true, isAccountOwner: false }, "t").isPrincipal).toBe(true)
        expect(mapUserResponse({ uuid: "u-1", isPrincipal: false, isAccountOwner: true }, "t").isPrincipal).toBe(false)
    })

    it("lee los flags de soporte del contrato y no los inventa", () => {
        expect(mapUserResponse({ uuid: "a", canAccessSupportConsole: true }, "t"))
            .toMatchObject({ canAccessSupportConsole: true, canManageSupportAgents: false })
        expect(mapUserResponse({ uuid: "b" }, "t"))
            .toMatchObject({ canAccessSupportConsole: false, canManageSupportAgents: false })
    })
})
