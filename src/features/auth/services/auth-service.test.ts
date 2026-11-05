import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    get: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({
    apiClient: { post: mocks.post, get: mocks.get },
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

describe("authService.getClient — un fallo no se disfraza de «sin cuenta»", () => {
    it("un fallo de la petición se lanza (antes devolvía null y el perfil guardaba la sesión encima)", async () => {
        mocks.get.mockRejectedValueOnce(new Error("503"))
        await expect(authService.getClient("c1")).rejects.toThrow("503")
    })

    it("una respuesta sin cuenta reconocible es null; una cuenta con uuid se lee", async () => {
        mocks.get.mockResolvedValueOnce({ data: {} })
        await expect(authService.getClient("c1")).resolves.toBeNull()
        mocks.get.mockResolvedValueOnce({ data: { uuid: "c1", name: "Hoteles SAS", personTypeId: 2 } })
        await expect(authService.getClient("c1")).resolves.toMatchObject({ uuid: "c1", profile: { name: "Hoteles SAS", personTypeId: "2" } })
    })
})
