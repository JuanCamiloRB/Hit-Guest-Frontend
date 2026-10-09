import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/features/auth/types"
import { useAuthStore } from "@/lib/store/auth-store"

const mocks = vi.hoisted(() => ({ revoke: vi.fn() }))
vi.mock("../services/admin-service", () => ({ adminService: { revokeImpersonation: mocks.revoke } }))

import { ACCOUNT_HOME, ADMIN_HOME, enterImpersonatedAccount, exitImpersonatedAccount } from "./impersonation-session"

const superuser = { id: "su", uuid: "su", clientId: "hit", email: "soporte@x.com", firstName: "Soporte", role: "PRINCIPAL", isPrincipal: true, token: "t-actor" } as User
const started = {
    id: "imp-1", token: "t-imp", mode: "read_only" as const, startedAt: "2026-10-09T15:04:00Z", expiresAt: "2026-10-09T16:04:00Z",
    user: { uuid: "u-1", email: "didier@x.com", name: "Didier", client_uuid: "c-1", client_name: "Pullman Miami SAS", isAccountOwner: true },
}

describe("impersonation-session — entrar y volver sin perder la sesión propia", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAuthStore.setState({ user: superuser, actor: null, isAuthenticated: true })
    })

    it("entra con el token emitido, guarda quién actúa y navega con recarga completa", () => {
        const navigate = vi.fn()
        enterImpersonatedAccount(started, navigate)
        const { user, actor } = useAuthStore.getState()
        expect(user?.token).toBe("t-imp")
        expect(user?.clientName).toBe("Pullman Miami SAS")
        expect(user?.impersonation).toMatchObject({ id: "imp-1", actorEmail: "soporte@x.com", mode: "read_only" })
        expect(actor?.token).toBe("t-actor")
        expect(navigate).toHaveBeenCalledWith(ACCOUNT_HOME)
    })

    it("dentro de una cuenta ajena no se entra a otra", () => {
        enterImpersonatedAccount(started, vi.fn())
        expect(() => enterImpersonatedAccount({ ...started, id: "imp-2", token: "t-2" }, vi.fn())).toThrow(/Vuelve a la tuya/)
        expect(useAuthStore.getState().user?.token).toBe("t-imp")
    })

    it("al volver, revoca CON EL TOKEN DEL SUPERUSUARIO (no con el suplantado) y vuelve al directorio", async () => {
        enterImpersonatedAccount(started, vi.fn())
        let tokenAtRevoke: string | undefined
        mocks.revoke.mockImplementation(async () => { tokenAtRevoke = useAuthStore.getState().user?.token })
        const navigate = vi.fn()

        await exitImpersonatedAccount(navigate)

        expect(mocks.revoke).toHaveBeenCalledWith("imp-1")
        expect(tokenAtRevoke).toBe("t-actor")
        expect(useAuthStore.getState().actor).toBeNull()
        expect(navigate).toHaveBeenCalledWith(ADMIN_HOME)
    })

    it("si la revocación falla, igual vuelve: el token vence solo", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        enterImpersonatedAccount(started, vi.fn())
        mocks.revoke.mockRejectedValue(new Error("red"))
        const navigate = vi.fn()
        await exitImpersonatedAccount(navigate)
        expect(useAuthStore.getState().user?.token).toBe("t-actor")
        expect(navigate).toHaveBeenCalledWith(ADMIN_HOME)
    })
})
