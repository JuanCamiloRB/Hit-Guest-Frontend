import { create } from "zustand"
import { persist } from "zustand/middleware"
import { User, AuthState } from "@/features/auth/types"

interface AuthActions {
    setSession: (user: User) => void
    clearSession: () => void
    setLoading: (isLoading: boolean) => void
    setError: (error: string | null) => void
    /**
     * Entra a la cuenta de otro usuario con un token suplantado. La sesión
     * actual pasa a `actor` SIN tocarse: es la que se recupera al salir, así
     * que el superusuario nunca pierde su sesión. Devuelve `false` si ya se
     * está suplantando (anidar está prohibido también en el backend).
     */
    beginImpersonation: (target: User) => boolean
    /** Vuelve a la sesión del superusuario. No hace nada si no se está suplantando. */
    endImpersonation: () => void
}

interface ImpersonationState {
    /**
     * La sesión propia del superusuario mientras está dentro de otra cuenta;
     * `null` fuera de una suplantación. `user` es SIEMPRE la sesión con la que
     * se llama al backend (la suplantada, si la hay).
     */
    actor: User | null
}

type AuthStore = AuthState & ImpersonationState & AuthActions

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
            clearSession: () => set({ user: null, actor: null, isAuthenticated: false, error: null }),
            setLoading: (isLoading: boolean) => set({ isLoading }),
            setError: (error: string | null) => set({ error }),

            beginImpersonation: (target: User) => {
                const { user, actor } = get()
                if (!user || actor) return false
                set({ actor: user, user: target, isAuthenticated: true, error: null })
                return true
            },
            endImpersonation: () => {
                const { actor } = get()
                if (!actor) return
                set({ user: actor, actor: null, isAuthenticated: true, error: null })
            },
        }),
        {
            name: "auth-storage", // name of the item in storage
            // Persiste las dos capas: recargar dentro de una cuenta ajena tiene
            // que seguir dentro de ella y conservar el camino de vuelta.
            partialize: (state) => ({
                user: state.user,
                actor: state.actor,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
