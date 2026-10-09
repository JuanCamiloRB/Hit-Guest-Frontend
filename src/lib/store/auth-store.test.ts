import { beforeEach, describe, expect, it } from "vitest"
import type { User } from "@/features/auth/types"
import { useAuthStore } from "./auth-store"

const superuser = { id: "su", clientId: "hit", email: "soporte@x.com", firstName: "Soporte", role: "PRINCIPAL", isPrincipal: true, token: "t-actor" } as User
const target = { id: "u-1", clientId: "c-1", email: "didier@x.com", firstName: "Didier", role: "PRINCIPAL", isPrincipal: true, token: "t-imp" } as User

describe("auth-store — sesión de dos capas", () => {
    beforeEach(() => {
        useAuthStore.setState({ user: null, actor: null, isAuthenticated: false })
        useAuthStore.getState().setSession(superuser)
    })

    it("entrar guarda la sesión del superusuario intacta y usa la del usuario", () => {
        expect(useAuthStore.getState().beginImpersonation(target)).toBe(true)
        expect(useAuthStore.getState().user?.token).toBe("t-imp")
        expect(useAuthStore.getState().actor?.token).toBe("t-actor")
    })

    it("no se puede anidar: dentro de una cuenta ajena no se entra a otra", () => {
        useAuthStore.getState().beginImpersonation(target)
        expect(useAuthStore.getState().beginImpersonation({ ...target, token: "t-otro" })).toBe(false)
        expect(useAuthStore.getState().user?.token).toBe("t-imp")
    })

    it("salir devuelve exactamente la sesión del superusuario", () => {
        useAuthStore.getState().beginImpersonation(target)
        useAuthStore.getState().endImpersonation()
        expect(useAuthStore.getState().user?.token).toBe("t-actor")
        expect(useAuthStore.getState().actor).toBeNull()
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it("cerrar sesión de verdad borra las dos capas", () => {
        useAuthStore.getState().beginImpersonation(target)
        useAuthStore.getState().clearSession()
        expect(useAuthStore.getState().user).toBeNull()
        expect(useAuthStore.getState().actor).toBeNull()
    })
})
