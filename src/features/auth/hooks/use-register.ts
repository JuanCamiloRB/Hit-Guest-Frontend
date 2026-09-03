"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { authService } from "../services/auth-service"
import { RegisterFormData, registerSchema } from "../types"
import { useFormSecurity } from "./use-form-security"

/**
 * Alta de cuenta. Termina en `/account/register` y ahí se acaba: **el registro
 * NO emite ningún código**.
 *
 * Quien manda el código de 6 dígitos es `POST /auth/login`, y el registro nunca
 * lo llama. La pantalla pedía un OTP que el backend jamás había enviado: lo
 * único que llega al correo es el mensaje de bienvenida con su enlace de acceso.
 * Reenviar tampoco servía —`/auth/resend-otp` necesita un challenge previo que
 * no existe—, así que el usuario quedaba encerrado esperando un código
 * imposible, con la cuenta ya creada.
 *
 * Por eso este hook no conoce OTP. El código vive donde de verdad se emite: en
 * el login.
 */
export function useRegister() {
    const [isLoading, setIsLoading] = useState(false)
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
            setIsSuccess(true)
            toast.success("¡Cuenta creada!", {
                description: "Te enviamos un correo de bienvenida. Ya puedes iniciar sesión.",
            })
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error al procesar el registro"
            setError(message)
            toast.error("Error", {
                description: message || "Por favor, inténtalo de nuevo.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return {
        form,
        isLoading,
        isSuccess,
        registeredEmail,
        error,
        onRegister: form.handleSubmit(onRegister),
        honeypotProps,
    }
}
