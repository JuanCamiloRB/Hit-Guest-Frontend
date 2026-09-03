import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({
    apiClient: { post: mocks.post },
    handleSessionExpired: vi.fn(),
}))

import { authService } from "./auth-service"

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
