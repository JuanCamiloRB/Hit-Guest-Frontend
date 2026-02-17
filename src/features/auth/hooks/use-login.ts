"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { authService } from "../services/auth-service"
import { LoginFormData, loginSchema } from "../types"
import { useAuthStore } from "@/lib/store/auth-store"

import { useRouter } from "next/navigation"

export function useLogin() {
    const router = useRouter()
    const { setSession, setLoading, setError, error } = useAuthStore()
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })

    async function onSubmit(values: LoginFormData) {
        setIsLoading(true)
        setLoading(true)
        setError(null) // Clear previous errors
        try {
            const user = await authService.loginWithEmail(values)
            setSession(user)
            toast.success("Welcome back!", {
                description: `Logged in as ${user.email}`,
            })
            router.push("/dashboard")
        } catch (err: any) {
            setError(err.message || "Authentication failed")
            toast.error("Authentication failed", {
                description: err.message || "Please check your credentials and try again.",
            })
        } finally {
            setIsLoading(false)
            setLoading(false)
        }
    }

    const togglePasswordVisibility = () => setShowPassword(!showPassword)

    return {
        form,
        isLoading,
        showPassword,
        error,
        togglePasswordVisibility,
        onSubmit: form.handleSubmit(onSubmit),
    }
}
