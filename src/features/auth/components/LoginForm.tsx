"use client"

import * as React from "react"
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormLabel,
} from "@/components/ui/form"
import { useLogin } from "../hooks/use-login"
import { Honeypot } from "./Honeypot"
import Link from "next/link"
import { Logo } from "@/components/ui/Logo"
import { useTranslation } from "@/hooks/useTranslation"
import { useLanguageStore } from "@/store/useLanguageStore"
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/dictionaries"

type UserAuthFormProps = React.HTMLAttributes<HTMLDivElement>

export function LoginForm({ className, ...props }: UserAuthFormProps) {
    const {
        emailForm,
        otpForm,
        isLoading,
        onRequestOtp,
        onVerifyOtp,
        step,
        email,
        resetFlow,
        error,
        timer,
        canResend,
        onResendOtp,
        honeypotProps,
    } = useLogin()
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    const { t } = useTranslation()
    const { language, setLanguage } = useLanguageStore()

    // Un botón que alterna entre dos idiomas no tiene sentido mientras solo haya
    // uno disponible: `setLanguage` rechazaría el inglés y el botón se vería
    // muerto. Se oculta hasta que exista la librería, y vuelve solo.
    const alternateLanguage = AVAILABLE_LANGUAGES.find((code) => code !== language)

    const toggleLanguage = () => {
        if (alternateLanguage) setLanguage(alternateLanguage)
    }

    return (
        <div className={cn("grid gap-8 bg-white p-8 rounded-xl shadow-sm border border-border/50", className)} {...props}>
            <div className="flex flex-col items-center gap-2 text-center mb-2">
                {alternateLanguage && (
                    <div className="absolute top-4 right-4 z-50">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleLanguage}
                        >
                            {alternateLanguage.toUpperCase()}
                        </Button>
                    </div>
                )}
                <Logo variant="icon" className="h-12 w-auto" />
                <p className="text-sm text-muted-foreground font-secondary mt-1">
                    {t('common.welcome')} - Gestión inteligente para hospitalidad
                </p>
            </div>
            {isMounted && error && (
                <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-center gap-2 border border-destructive/20 animate-in fade-in zoom-in duration-200">
                    <Icon icon={AlertCircle} />
                    <span>{error}</span>
                </div>
            )}

            {step === "email" ? (
                <Form {...emailForm}>
                    <form onSubmit={onRequestOtp}>
                        <Honeypot {...honeypotProps} />
                        <div className="grid gap-4">
                            <FormField
                                control={emailForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem id="email-form-item">
                                        <FormLabel>Correo electrónico <span className="text-destructive">*</span></FormLabel>
                                            <div className="relative">
                                                <Icon icon={Mail} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                <FormControl>
                                                    <Input
                                                    placeholder="nombre@hitguest.com"
                                                    type="email"
                                                    autoCapitalize="none"
                                                    autoComplete="email"
                                                    autoCorrect="off"
                                                    disabled={isLoading}
                                                    className="pl-9"
                                                    {...field}
                                                />
                                                </FormControl>
                                            </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button size="lg"
                                disabled={isLoading}
                            >
                                {isLoading && <Icon icon={Loader2} className="mr-2 animate-spin text-white" />}
                                Continuar con el acceso
                            </Button>
                        </div>
                    </form>
                </Form>
            ) : (
                <Form {...otpForm}>
                    <form onSubmit={onVerifyOtp}>
                        <Honeypot {...honeypotProps} />
                        <div className="grid gap-4">
                            <div className="bg-muted/50 p-4 rounded-lg text-center">
                                <p className="text-sm text-muted-foreground mb-1">
                                    Hemos enviado un código a:
                                </p>
                                <p className="text-sm font-semibold">{email}</p>
                            </div>
                            <FormField
                                control={otpForm.control}
                                name="otp"
                                render={({ field }) => (
                                    <FormItem id="otp-form-item">
                                        <div className="flex justify-between items-center mb-2">
                                            <FormLabel className="m-0">Código OTP <span className="text-destructive">*</span></FormLabel>
                                            <Button variant="link" size="inline"
                                                type="button"
                                                onClick={resetFlow}
                                            >
                                                Cambiar correo
                                            </Button>
                                        </div>
                                            <div className="relative">
                                                <Icon icon={Lock} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                <FormControl>
                                                    <Input
                                                    id="otp"
                                                    placeholder="123456"
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={6}
                                                    disabled={isLoading}
                                                    className="pl-9 text-center tracking-widest font-mono text-lg"
                                                    {...field}
                                                />
                                                </FormControl>
                                            </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-col gap-3">
                                <Button size="lg"
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    {isLoading && <Icon icon={Loader2} className="mr-2 animate-spin text-white" />}
                                    Verificar e Iniciar Sesión
                                </Button>

                                <div className="text-center">
                                    {timer > 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Podrás solicitar un nuevo código en{" "}
                                            <span className="font-medium text-foreground">
                                                {Math.floor(timer / 60)}:
                                                {(timer % 60).toString().padStart(2, "0")}
                                            </span>
                                        </p>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            onClick={onResendOtp}
                                            disabled={isLoading || !canResend}
                                        >
                                            Solicitar un nuevo código
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </Form>
            )}
            <div className="mt-4 text-center text-sm">
                <p className="text-muted-foreground">
                    ¿No tienes cuenta?{" "}
                    <Link
                        href="/register"
                        className="font-semibold text-secondary hover:text-secondary transition-colors underline-offset-4 hover:underline"
                    >
                        Regístrate aquí
                    </Link>
                </p>
            </div>
        </div>
    )
}
