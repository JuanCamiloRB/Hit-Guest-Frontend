"use client"

import { useAuthStore } from "@/lib/store/auth-store"
import { exitSupportSession } from "@/features/support/lib/support-session"
import { authService } from "../services/auth-service"

export function useAuth() {
    const { user, actor, isAuthenticated, isLoading, error, clearSession } = useAuthStore()
    const isInSupportSession = actor !== null

    const logout = async () => {
        // En modo soporte, «cerrar sesión» sale de la sesión de soporte y
        // devuelve al agente a la consola: su propia sesión no se cierra.
        if (isInSupportSession) {
            await exitSupportSession()
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
        /** La sesión propia del agente mientras está en modo soporte. */
        actor,
        isInSupportSession,
        isAuthenticated,
        isLoading,
        error,
        logout,
    }
}
