import { create } from "zustand"
import { persist } from "zustand/middleware"
import { User, AuthState } from "@/features/auth/types"

interface AuthActions {
    setSession: (user: User) => void
    clearSession: () => void
    setLoading: (isLoading: boolean) => void
    setError: (error: string | null) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            setSession: (user: User) => {
                set({ user, isAuthenticated: true, error: null })
            },
            clearSession: () => set({ user: null, isAuthenticated: false, error: null }),
            setLoading: (isLoading: boolean) => set({ isLoading }),
            setError: (error: string | null) => set({ error }),
        }),
        {
            name: "auth-storage", // name of the item in storage
            // Only persist user and authentication status
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
