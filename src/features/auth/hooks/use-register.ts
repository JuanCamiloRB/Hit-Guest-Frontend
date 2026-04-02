"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { authService } from "../services/auth-service"
import { RegisterFormData, registerSchema } from "../types"
import { useFormSecurity } from "./use-form-security"

export function useRegister() {
    const [isLoading, setIsLoading] = useState(false)
    const [isAwaitingOtp, setIsAwaitingOtp] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [registeredEmail, setRegisteredEmail] = useState("")

    const { honeypotProps, validateSubmission } = useFormSecurity({
        formId: "register-flow",
        minTime: 3000,
    })

    const form = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            identificationTypeId: "",
            identificationNumber: "",
            companyName: "",
            name: "",
            lastname: "",
            email: "",
            phone: "",
            country: "",
            state: "",
            city: "",
        },
    })

    async function onRegister(values: RegisterFormData) {
        if (!validateSubmission()) return
        setIsLoading(true)
        setError(null)
        try {
            await authService.register(values)
            setRegisteredEmail(values.email)
            setIsAwaitingOtp(true)
            toast.success("¡Información enviada!", {
                description: "Hemos enviado un código de activación a tu correo.",
            })
        } catch (err: any) {
            setError(err.message || "Error al procesar el registro")
            toast.error("Error", {
                description: err.message || "Por favor, inténtalo de nuevo.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    async function onVerifyOtp(otp: string) {
        setIsLoading(true)
        setError(null)
        try {
            const user = await authService.verifyOtp(registeredEmail, otp)
            setIsSuccess(true)
            setIsAwaitingOtp(false)
            toast.success("¡Cuenta activada!", {
                description: "Bienvenido a Hit Guest.",
            })
            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = "/dashboard"
            }, 2000)
        } catch (err: any) {
            setError(err.message || "Código inválido")
            toast.error("Error de verificación", {
                description: err.message || "El código ingresado no es correcto.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    async function onResendOtp() {
        if (!registeredEmail) return
        setIsLoading(true)
        try {
            await authService.resendOtp(registeredEmail)
            toast.success("Código reenviado", {
                description: "Revisa tu bandeja de entrada o la consola del navegador.",
            })
        } catch (err: any) {
            toast.error("Error", {
                description: err.message || "No se pudo reenviar el código.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const resetRegistration = () => {
        setIsAwaitingOtp(false)
        setIsSuccess(false)
        setError(null)
        form.reset({
            identificationTypeId: "",
            identificationNumber: "",
            companyName: "",
            name: "",
            lastname: "",
            email: "",
            phone: "",
            country: "",
            state: "",
            city: "",
        })
    }

    return {
        form,
        isLoading,
        isAwaitingOtp,
        isSuccess,
        registeredEmail,
        error,
        onRegister: form.handleSubmit(onRegister),
        onVerifyOtp,
        onResendOtp,
        resetRegistration,
        honeypotProps,
    }
}
