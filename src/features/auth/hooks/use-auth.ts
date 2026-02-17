"use client"

import { useAuthStore } from "@/lib/store/auth-store"
import { authService } from "../services/auth-service"

export function useAuth() {
    const { user, isAuthenticated, isLoading, error, clearSession } = useAuthStore()

    const logout = async () => {
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
        isAuthenticated,
        isLoading,
        error,
        logout,
    }
}
