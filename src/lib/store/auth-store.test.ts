import { beforeEach, describe, expect, it } from "vitest"
import type { User } from "@/features/auth/types"
import type { SupportSession } from "@/features/support/lib/support-readers"
import { useAuthStore } from "./auth-store"

const agent = { id: "ag-1", uuid: "ag-1", clientId: "hit", email: "laura@hit.tools", firstName: "Laura", role: "PRINCIPAL", isPrincipal: true, token: "t-agente", canAccessSupportConsole: true } as User
const target = { id: "u-1", uuid: "u-1", clientId: "c-1", email: "ana@casa.test", firstName: "Ana", role: "PRINCIPAL", isPrincipal: true, token: "t-soporte" } as User

const SUPPORT_KEY = "support-session"
const readLocal = () => JSON.parse(localStorage.getItem("auth-storage") ?? "{}") as { state?: { user?: User; actor?: unknown } }

describe("auth-store — modo soporte (contrato §5b)", () => {
    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
        useAuthStore.setState({ user: null, actor: null, isAuthenticated: false })
        useAuthStore.getState().setSession(agent)
    })

    it("entrar conserva la sesión del agente intacta y usa la de soporte", () => {
        expect(useAuthStore.getState().beginSupportSession(target)).toBe(true)
        expect(useAuthStore.getState().user?.token).toBe("t-soporte")
        expect(useAuthStore.getState().actor?.token).toBe("t-agente")
    })

    it("el token de soporte va a sessionStorage y NUNCA a localStorage", () => {
        useAuthStore.getState().beginSupportSession(target)

        const stored = JSON.parse(sessionStorage.getItem(SUPPORT_KEY) ?? "null")
        expect(stored).toMatchObject({ agentId: "ag-1", user: { token: "t-soporte" } })
        expect(readLocal().state?.user?.token).toBe("t-agente")
        expect(JSON.stringify(readLocal())).not.toContain("t-soporte")
    })

    it("no se anida: en modo soporte no se abre otra sesión", () => {
        useAuthStore.getState().beginSupportSession(target)
        expect(useAuthStore.getState().beginSupportSession({ ...target, token: "t-otro" })).toBe(false)
        expect(useAuthStore.getState().user?.token).toBe("t-soporte")
    })

    it("salir devuelve exactamente la sesión del agente y borra el token de soporte", () => {
        useAuthStore.getState().beginSupportSession(target)
        useAuthStore.getState().endSupportSession()
        expect(useAuthStore.getState().user?.token).toBe("t-agente")
        expect(useAuthStore.getState().actor).toBeNull()
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
        expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull()
    })

    it("cerrar sesión de verdad borra las dos capas", () => {
        useAuthStore.getState().beginSupportSession(target)
        useAuthStore.getState().clearSession()
        expect(useAuthStore.getState().user).toBeNull()
        expect(useAuthStore.getState().actor).toBeNull()
        expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull()
    })

    it("refrescar los datos del banner los guarda también en la pestaña", () => {
        useAuthStore.getState().beginSupportSession(target)
        const session = { uuid: "s-1", clientName: "Casa Rentals", idleTimeoutMinutes: 60 } as SupportSession
        useAuthStore.getState().updateSupportSession(session)

        expect(useAuthStore.getState().user?.supportSession?.uuid).toBe("s-1")
        expect(JSON.parse(sessionStorage.getItem(SUPPORT_KEY) ?? "null").user.supportSession.uuid).toBe("s-1")
    })

    it("al recargar la pestaña, vuelve al modo soporte del mismo agente", async () => {
        useAuthStore.getState().beginSupportSession(target)
        useAuthStore.setState({ user: null, actor: null, isAuthenticated: false }, false)
        localStorage.setItem("auth-storage", JSON.stringify({ state: { user: agent, isAuthenticated: true }, version: 0 }))

        await useAuthStore.persist.rehydrate()

        expect(useAuthStore.getState().user?.token).toBe("t-soporte")
        expect(useAuthStore.getState().actor?.token).toBe("t-agente")
    })

    it("al recargar con la sesión de OTRO agente, descarta el token de soporte", async () => {
        sessionStorage.setItem(SUPPORT_KEY, JSON.stringify({ agentId: "otro-agente", user: target }))
        localStorage.setItem("auth-storage", JSON.stringify({ state: { user: agent, isAuthenticated: true }, version: 0 }))

        await useAuthStore.persist.rehydrate()

        expect(useAuthStore.getState().user?.token).toBe("t-agente")
        expect(useAuthStore.getState().actor).toBeNull()
        expect(sessionStorage.getItem(SUPPORT_KEY)).toBeNull()
    })
})
