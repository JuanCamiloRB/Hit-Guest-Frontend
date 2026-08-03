"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, KeyRound, Mail, Lock, Tag, Plug, Eye, EyeOff } from "lucide-react"
import { notifyError } from "@/lib/notify-error"
import type { KunasConnectPayload } from "../types"
import {
    extractFieldErrors,
    isCredentialError,
    type IntegrationFieldErrors,
} from "../lib/integration-errors"

interface Props {
    /** Connects with the given payload; rejects on failure (form shows errors). */
    onConnect: (payload: KunasConnectPayload) => Promise<void>
}

/** First-connection form (state: no integration → 404). */
export function KunasConnectForm({ onConnect }: Props) {
    const [token, setToken] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [name, setName] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<IntegrationFieldErrors>({})

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrors({})
        setIsSubmitting(true)
        try {
            await onConnect({
                token: token.trim(),
                email: email.trim(),
                password,
                name: name.trim() || undefined,
            })
            toast.success("KunasPMS conectado", {
                description:
                    "Sincronización en progreso — tus propiedades y reservas se importarán en breve.",
            })
        } catch (error) {
            const fieldErrors = extractFieldErrors(error)
            setErrors(fieldErrors)
            // A credential rejection is shown inline; anything without field-level
            // detail falls back to a toast so the PM still sees the reason.
            if (!isCredentialError(error) && !hasAnyFieldError(fieldErrors)) {
                notifyError(error, "No se pudo conectar con KunasPMS")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const canSubmit = token.trim() && email.trim() && password && !isSubmitting

    return (
        <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
            <p className="text-sm text-slate-500">
                Conecta tu cuenta de KunasPMS para sincronizar propiedades y reservas.
            </p>

            {errors.credentials && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {errors.credentials}
                </div>
            )}

            <Field
                label="Token KunasPMS"
                icon={<KeyRound className="h-4 w-4" />}
                required
                error={errors.token}
            >
                <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Token entregado por KunasPMS"
                    autoComplete="off"
                />
            </Field>

            <Field label="Email" icon={<Mail className="h-4 w-4" />} required error={errors.email}>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pm@empresa.com"
                    autoComplete="email"
                />
            </Field>

            <Field label="Contraseña" icon={<Lock className="h-4 w-4" />} required error={errors.password}>
                <div className="relative">
                    <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña de tu cuenta KunasPMS"
                        autoComplete="off"
                        className="pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </Field>

            <Field label="Nombre (opcional)" icon={<Tag className="h-4 w-4" />} error={errors.name}>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mi integración Kunas"
                />
            </Field>

            <Button
                type="submit"
                disabled={!canSubmit}
                className="gap-2 bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-white font-bold"
            >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Conectar KunasPMS
            </Button>
        </form>
    )
}

function hasAnyFieldError(errors: IntegrationFieldErrors): boolean {
    return Object.values(errors).some(Boolean)
}

/** Small labelled field wrapper with an optional inline error. */
function Field({
    label,
    icon,
    required,
    error,
    children,
}: {
    label: string
    icon: React.ReactNode
    required?: boolean
    error?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <span className="text-slate-400">{icon}</span>
                {label}
                {required && <span className="text-red-400">*</span>}
            </label>
            {children}
            {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>
    )
}
