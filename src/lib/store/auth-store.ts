import { create } from "zustand"
import { persist } from "zustand/middleware"
import { User, AuthState } from "@/features/auth/types"
import type { SupportSession } from "@/features/support/lib/support-readers"

interface AuthActions {
    setSession: (user: User) => void
    clearSession: () => void
    setLoading: (isLoading: boolean) => void
    setError: (error: string | null) => void
    /**
     * Entra en modo soporte con el token de soporte. La sesión del agente pasa a
     * `actor` SIN tocarse: es la que se recupera al salir, así que el agente
     * nunca pierde su sesión. Devuelve `false` si ya está en modo soporte.
     */
    beginSupportSession: (target: User) => boolean
    /** Vuelve a la sesión del agente. No hace nada fuera del modo soporte. */
    endSupportSession: () => void
    /** Refresca los datos del banner con lo que devuelve `GET /support/sessions/current`. */
    updateSupportSession: (session: SupportSession) => void
}

interface SupportState {
    /**
     * La sesión propia del agente mientras está en modo soporte; `null` fuera de
     * él. `user` es SIEMPRE la sesión con la que se llama al backend (la de
     * soporte, si la hay).
     */
    actor: User | null
}

type AuthStore = AuthState & SupportState & AuthActions

/**
 * El token de soporte vive en `sessionStorage` (contrato §5b): muere con la
 * pestaña, y otra pestaña sigue con la sesión del agente. El del agente sigue
 * donde estaba (`localStorage`, vía `persist`). Va ligado al agente que lo
 * abrió: si la sesión persistida es de otra persona, se descarta.
 */
const SUPPORT_STORAGE_KEY = "support-session"

interface StoredSupportLayer {
    agentId: string
    user: User
}

function sessionIdOf(user: User): string {
    return user.uuid ?? user.id
}

function readSupportLayer(): StoredSupportLayer | null {
    try {
        const raw = window.sessionStorage.getItem(SUPPORT_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<StoredSupportLayer>
        return typeof parsed?.agentId === "string" && typeof parsed.user?.token === "string"
            ? (parsed as StoredSupportLayer)
            : null
    } catch {
        return null
    }
}

function writeSupportLayer(layer: StoredSupportLayer | null): void {
    try {
        if (layer) window.sessionStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify(layer))
        else window.sessionStorage.removeItem(SUPPORT_STORAGE_KEY)
    } catch {
        // Sin sessionStorage (modo privado estricto) el modo soporte dura lo que
        // dure la página; al recargar se vuelve a la sesión del agente.
    }
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            user: null,
            actor: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            setSession: (user: User) => {
                set({ user, isAuthenticated: true, error: null })
            },
            // Cerrar sesión de verdad: las dos capas.
            clearSession: () => {
                writeSupportLayer(null)
                set({ user: null, actor: null, isAuthenticated: false, error: null })
            },
            setLoading: (isLoading: boolean) => set({ isLoading }),
            setError: (error: string | null) => set({ error }),

            beginSupportSession: (target: User) => {
                const { user, actor } = get()
                if (!user || actor) return false
                writeSupportLayer({ agentId: sessionIdOf(user), user: target })
                set({ actor: user, user: target, isAuthenticated: true, error: null })
                return true
            },
            endSupportSession: () => {
                const { actor } = get()
                writeSupportLayer(null)
                if (!actor) return
                set({ user: actor, actor: null, isAuthenticated: true, error: null })
            },
            updateSupportSession: (session: SupportSession) => {
                const { user, actor } = get()
                if (!user || !actor) return
                const next = { ...user, supportSession: session }
                writeSupportLayer({ agentId: sessionIdOf(actor), user: next })
                set({ user: next })
            },
        }),
        {
            name: "auth-storage", // name of the item in storage
            // En `localStorage` va SOLO la sesión del agente: la de soporte nunca
            // sale de la pestaña (ver `SUPPORT_STORAGE_KEY`).
            partialize: (state) => ({
                user: state.actor ?? state.user,
                isAuthenticated: state.isAuthenticated,
            }),
            merge: (persisted, current) => {
                const base: AuthStore = { ...current, ...(persisted as Partial<AuthStore>), actor: null }
                const support = readSupportLayer()
                if (support && base.user && support.agentId === sessionIdOf(base.user)) {
                    return { ...base, actor: base.user, user: support.user, isAuthenticated: true }
                }
                if (support) writeSupportLayer(null)
                return base
            },
        }
    )
)
