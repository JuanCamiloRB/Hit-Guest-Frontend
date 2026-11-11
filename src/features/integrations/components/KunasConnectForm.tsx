"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { KeyRound, Mail, Lock, Tag, Plug } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { notifyError } from "@/lib/notify-error"
import type { KunasConnectPayload } from "../types"
import {
    extractFieldErrors,
    isCredentialError,
    type IntegrationFieldErrors,
} from "../lib/integration-errors"
import { Label } from "@/components/ui/label"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { FieldError } from "@/components/ui/form"

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
            <p className="text-sm text-ink-3">
                Conecta tu cuenta de KunasPMS para sincronizar propiedades y reservas.
            </p>

            {errors.credentials && (
                <FeedbackBanner tone="danger" mode="dynamic">{errors.credentials}</FeedbackBanner>
            )}

            <Field
                label="Token KunasPMS"
                icon={<Icon icon={KeyRound} />}
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

            <Field label="Email" icon={<Icon icon={Mail} />} required error={errors.email}>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pm@empresa.com"
                    autoComplete="email"
                />
            </Field>

            <Field label="Contraseña" icon={<Icon icon={Lock} />} required error={errors.password}>
                <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña de tu cuenta KunasPMS"
                    autoComplete="off"
                />
            </Field>

            <Field label="Nombre (opcional)" icon={<Icon icon={Tag} />} error={errors.name}>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mi integración Kunas"
                />
            </Field>

            <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
                <Icon icon={Plug} />
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
            <Label variant="plain" className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
                <span className="text-ink-3">{icon}</span>
                {label}
                {required && <span className="text-danger">*</span>}
            </Label>
            {children}
            {error && <FieldError>{error}</FieldError>}
        </div>
    )
}
