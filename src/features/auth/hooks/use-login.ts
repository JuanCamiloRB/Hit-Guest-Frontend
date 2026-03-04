"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { authService } from "../services/auth-service"
import { LoginFormData, loginSchema, OtpFormData, otpSchema } from "../types"
import { useAuthStore } from "@/lib/store/auth-store"

import { useRouter } from "next/navigation"
import { useFormSecurity } from "./use-form-security"

export function useLogin() {
    const router = useRouter()
    const { setSession, setLoading, setError, error } = useAuthStore()
    const [isLoading, setIsLoading] = useState(false)
    const [step, setStep] = useState<"email" | "otp">("email")
    const [email, setEmail] = useState("")

    // Timer Logic
    const [timer, setTimer] = useState(0) // in seconds
    const [canResend, setCanResend] = useState(true)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Security Hook
    const { honeypotProps, validateSubmission } = useFormSecurity({
        formId: "login-flow",
        minTime: 2000,
    })

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    const startTimer = (duration: number) => {
        if (timerRef.current) clearInterval(timerRef.current)
        setTimer(duration)
        setCanResend(false)
        timerRef.current = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current)
                    setCanResend(true)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

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
        if (!validateSubmission()) return
        setIsLoading(true)
        setLoading(true)
        setError(null)
        try {
            await authService.requestOtp(values.email)
            setEmail(values.email)
            setStep("otp")
            startTimer(180) // 3 minutes = 180 seconds
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
        if (!validateSubmission()) return
        setIsLoading(true)
        setLoading(true)
        setError(null)
        try {
            const user = await authService.verifyOtp(email, values.otp)
            setSession(user)
            toast.success("¡Bienvenido de nuevo!", {
                description: `Sesión iniciada correctamente`,
            })
            router.push("/dashboard")
        } catch (err: any) {
            setError(err.message || "Error al verificar el código")

            // If API sends structured errors, you might want to parse them
            // const errorMessage = err.message.includes("401") ? "Código inválido" : err.message

            toast.error("Error de verificación", {
                description: err.message || "El código ingresado no es válido.",
            })
        } finally {
            setIsLoading(false)
            setLoading(false)
        }
    }

    async function onResendOtp() {
        if (!email) return
        setIsLoading(true)
        try {
            await authService.resendOtp(email)
            startTimer(180)
            toast.success("Código reenviado", {
                description: `Se ha enviado un nuevo código a ${email}.`
            })
        } catch (err: any) {
            toast.error("Error al reenviar", {
                description: err.message
            })
        } finally {
            setIsLoading(false)
        }
    }

    const resetFlow = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setStep("email")
        setEmail("")
        otpForm.reset()
        setTimer(0)
        setCanResend(true)
    }

    return {
        emailForm,
        otpForm,
        isLoading,
        error,
        step,
        email,
        timer,
        canResend,
        onResendOtp,
        onRequestOtp: emailForm.handleSubmit(onRequestOtp),
        onVerifyOtp: otpForm.handleSubmit(onVerifyOtp),
        resetFlow,
        honeypotProps,
    }
}
