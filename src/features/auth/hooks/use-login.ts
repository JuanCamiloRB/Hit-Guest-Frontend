"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { authService } from "../services/auth-service"
import { LoginFormData, loginSchema, OtpFormData, otpSchema } from "../types"
import { useAuthStore } from "@/lib/store/auth-store"

import { useRouter } from "next/navigation"

export function useLogin() {
    const router = useRouter()
    const { setSession, setLoading, setError, error } = useAuthStore()
    const [isLoading, setIsLoading] = useState(false)
    const [step, setStep] = useState<"email" | "otp">("email")
    const [email, setEmail] = useState("")

    const emailForm = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
        },
    })

    const otpForm = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: {
            otp: "",
        },
    })

    async function onRequestOtp(values: LoginFormData) {
        setIsLoading(true)
        setLoading(true)
        setError(null)
        try {
            await authService.requestOtp(values.email)
            setEmail(values.email)
            setStep("otp")
            toast.success("Código enviado", {
                description: `Hemos enviado un código a ${values.email}`,
            })
        } catch (err: any) {
            setError(err.message || "Error al solicitar el código")
            toast.error("Error", {
                description: err.message || "Por favor, inténtalo de nuevo.",
            })
        } finally {
            setIsLoading(false)
            setLoading(false)
        }
    }

    async function onVerifyOtp(values: OtpFormData) {
        setIsLoading(true)
        setLoading(true)
        setError(null)
        try {
            const user = await authService.verifyOtp(email, values.otp)
            setSession(user)
            toast.success("¡Bienvenido de nuevo!", {
                description: `Sesión iniciada como ${user.email}`,
            })
            router.push("/dashboard")
        } catch (err: any) {
            setError(err.message || "Error al verificar el código")
            toast.error("Error de verificación", {
                description: err.message || "El código ingresado no es válido.",
            })
        } finally {
            setIsLoading(false)
            setLoading(false)
        }
    }

    const resetFlow = () => {
        setStep("email")
        setEmail("")
        otpForm.reset()
    }

    return {
        emailForm,
        otpForm,
        isLoading,
        error,
        step,
        email,
        onRequestOtp: emailForm.handleSubmit(onRequestOtp),
        onVerifyOtp: otpForm.handleSubmit(onVerifyOtp),
        resetFlow,
    }
}
