"use client"

import * as React from "react"
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"
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

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            {isMounted && error && (
                <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md flex items-center gap-2 border border-destructive/20 animate-in fade-in zoom-in duration-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
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
                                        <FormLabel>Correo electrónico</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="email"
                                                    placeholder="nombre@hitguest.com"
                                                    type="email"
                                                    autoCapitalize="none"
                                                    autoComplete="email"
                                                    autoCorrect="off"
                                                    disabled={isLoading}
                                                    className="pl-9"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                disabled={isLoading}
                                className="bg-caribbean-green hover:bg-caribbean-green/90 text-primary font-bold shadow-sm"
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enviar código
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
                                            <FormLabel className="m-0">Código OTP</FormLabel>
                                            <button
                                                type="button"
                                                onClick={resetFlow}
                                                className="text-[12px] text-pink-flamingo hover:underline"
                                            >
                                                Cambiar correo
                                            </button>
                                        </div>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="otp"
                                                    placeholder="123456"
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={6}
                                                    disabled={isLoading}
                                                    className="pl-9 text-center tracking-[1em] font-mono text-lg"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex flex-col gap-3">
                                <Button
                                    disabled={isLoading}
                                    className="bg-caribbean-green hover:bg-caribbean-green/90 text-primary font-bold shadow-sm w-full"
                                >
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                                            variant="ghost"
                                            className="text-xs text-pink-flamingo hover:text-pink-flamingo/90 hover:bg-pink-flamingo/10 h-auto py-2"
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
                        className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors underline-offset-4 hover:underline"
                    >
                        Regístrate aquí
                    </Link>
                </p>
            </div>
        </div>
    )
}
