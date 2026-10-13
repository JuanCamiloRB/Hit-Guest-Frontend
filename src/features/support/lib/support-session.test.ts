import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/features/auth/types"
import { useAuthStore } from "@/lib/store/auth-store"
import type { StartedSupportSession } from "./support-readers"

const mocks = vi.hoisted(() => ({ end: vi.fn(), tokenAtEnd: null as string | null | undefined }))
vi.mock("../services/support-service", () => ({
    supportService: {
        endCurrentSession: async () => {
            mocks.tokenAtEnd = (await import("@/lib/store/auth-store")).useAuthStore.getState().user?.token
            return mocks.end()
        },
    },
}))

import { ACCOUNT_HOME, SUPPORT_ENDED_URL, SUPPORT_HOME, enterSupportSession, exitSupportSession, leaveEndedSupportSession } from "./support-session"

const agent = { id: "ag-1", uuid: "ag-1", clientId: "hit", email: "laura@hit.tools", firstName: "Laura", role: "PRINCIPAL", isPrincipal: true, token: "t-agente" } as User

/** El 201 del contrato §9, ya leído. */
const started: StartedSupportSession = {
    token: "t-soporte",
    session: {
        uuid: "s-1", clientUuid: "c-1", clientName: "Casa Rentals252a2", userUuid: "u-1", userName: "Ana Pérez",
        userEmail: "ana@casa.test", reason: "Ticket 77: revisar contrato", status: "active", idleTimeoutMinutes: 60,
        startedAt: "2026-10-10T17:13:37-05:00", lastActivityAt: "2026-10-10T17:13:37-05:00", expiresAt: "2026-10-10T18:13:37-05:00",
    },
    user: {
        uuid: "u-1", clientUuid: "c-1", clientName: "Casa Rentals252a2", name: "Ana Pérez", email: "ana@casa.test",
        isAccountOwner: true, canAccessSupportConsole: false, canManageSupportAgents: false,
    },
}

describe("support-session — entrar y salir sin perder la sesión del agente", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.tokenAtEnd = null
        sessionStorage.clear()
        useAuthStore.setState({ user: agent, actor: null, isAuthenticated: true })
    })

    it("entra con el token de soporte, el usuario del cliente y los datos del banner", () => {
        const navigate = vi.fn()
        enterSupportSession(started, navigate)
        const { user, actor } = useAuthStore.getState()
        expect(user?.token).toBe("t-soporte")
        expect(user?.clientName).toBe("Casa Rentals252a2")
        expect(user?.canAccessSupportConsole).toBe(false)
        expect(user?.supportSession?.idleTimeoutMinutes).toBe(60)
        expect(actor?.token).toBe("t-agente")
        expect(navigate).toHaveBeenCalledWith(ACCOUNT_HOME)
    })

    it("en modo soporte no se abre otra sesión", () => {
        enterSupportSession(started, vi.fn())
        expect(() => enterSupportSession({ ...started, token: "t-2" }, vi.fn())).toThrow(/Sal de esa sesión/)
        expect(useAuthStore.getState().user?.token).toBe("t-soporte")
    })

    it("al salir, cierra la sesión CON EL TOKEN DE SOPORTE y vuelve a la consola como el agente", async () => {
        enterSupportSession(started, vi.fn())
        const navigate = vi.fn()

        await exitSupportSession(navigate)

        expect(mocks.end).toHaveBeenCalledOnce()
        expect(mocks.tokenAtEnd).toBe("t-soporte")
        expect(useAuthStore.getState().user?.token).toBe("t-agente")
        expect(navigate).toHaveBeenCalledWith(SUPPORT_HOME)
    })

    it("si el cierre falla, igual vuelve a la sesión del agente", async () => {
        mocks.end.mockRejectedValueOnce(new Error("network"))
        vi.spyOn(console, "warn").mockImplementation(() => {})
        enterSupportSession(started, vi.fn())
        const navigate = vi.fn()

        await exitSupportSession(navigate)

        expect(useAuthStore.getState().user?.token).toBe("t-agente")
        expect(navigate).toHaveBeenCalledWith(SUPPORT_HOME)
    })

    it("una sesión ya cerrada vuelve a la consola SIN llamar a end y avisa", () => {
        enterSupportSession(started, vi.fn())
        const navigate = vi.fn()

        leaveEndedSupportSession(navigate)

        expect(mocks.end).not.toHaveBeenCalled()
        expect(useAuthStore.getState().user?.token).toBe("t-agente")
        expect(navigate).toHaveBeenCalledWith(SUPPORT_ENDED_URL)
    })
})
