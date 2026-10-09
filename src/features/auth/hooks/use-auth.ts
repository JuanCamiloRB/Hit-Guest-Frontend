"use client"

import { useAuthStore } from "@/lib/store/auth-store"
import { exitImpersonatedAccount } from "@/features/admin/lib/impersonation-session"
import { authService } from "../services/auth-service"

export function useAuth() {
    const { user, actor, isAuthenticated, isLoading, error, clearSession } = useAuthStore()
    const isImpersonating = actor !== null

    const logout = async () => {
        // Dentro de la cuenta de otro usuario, «cerrar sesión» devuelve al
        // superusuario a la suya: su sesión no se cierra desde una cuenta ajena.
        if (isImpersonating) {
            await exitImpersonatedAccount()
            return
        }
        try {
            await authService.logout()
            clearSession()
            // Redirect to login
            window.location.href = "/login"
        } catch (error) {
            console.error("Logout failed", error)
        }
    }

    return {
        user,
        /** La sesión propia del superusuario mientras está dentro de otra cuenta. */
        actor,
        isImpersonating,
        isAuthenticated,
        isLoading,
        error,
        logout,
    }
}
