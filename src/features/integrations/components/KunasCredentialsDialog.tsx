"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { KeyRound } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { notifyError } from "@/lib/notify-error"
import type { KunasConfigurationPayload } from "../types"
import {
    extractFieldErrors,
    isCredentialError,
    type IntegrationFieldErrors,
} from "../lib/integration-errors"
import { Label } from "@/components/ui/label"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { FieldError } from "@/components/ui/form"

interface Props {
    /** Current account email (prefills the field; password never prefilled). */
    currentEmail: string
    trigger: React.ReactNode
    /** Persists new credentials; rejects on failure (dialog shows errors). */
    onSave: (payload: KunasConfigurationPayload) => Promise<void>
}

/**
 * Edit stored KunasPMS credentials (PATCH /configuration). This validates and
 * updates credentials only — it does NOT re-sync properties/reservations.
 */
export function KunasCredentialsDialog({ currentEmail, trigger, onSave }: Props) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState(currentEmail)
    const [password, setPassword] = useState("")
    // Token is never returned by the API, so the field starts blank and only
    // travels in the payload when the PM actually types a new one.
    const [token, setToken] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [errors, setErrors] = useState<IntegrationFieldErrors>({})

    // Reset local state whenever the dialog opens so it reflects current data.
    function handleOpenChange(next: boolean) {
        if (next) {
            setEmail(currentEmail)
            setPassword("")
            setToken("")
            setErrors({})
        }
        setOpen(next)
    }

    async function handleSave() {
        setErrors({})
        setIsSaving(true)
        try {
            const trimmedToken = token.trim()
            await onSave({
                email: email.trim(),
                password,
                ...(trimmedToken ? { token: trimmedToken } : {}),
            })
            toast.success("Credenciales actualizadas")
            setOpen(false)
        } catch (error) {
            const fieldErrors = extractFieldErrors(error)
            setErrors(fieldErrors)
            if (
                !isCredentialError(error) &&
                !Object.values(fieldErrors).some(Boolean)
            ) {
                notifyError(error, "No se pudieron actualizar las credenciales")
            }
        } finally {
            setIsSaving(false)
        }
    }

    const canSave = email.trim() && password && !isSaving

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar credenciales de KunasPMS</DialogTitle>
                    <DialogDescription>
                        Actualiza el email, la contraseña o el token de tu cuenta KunasPMS. No
                        vuelve a sincronizar tus propiedades.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {errors.credentials && (
                        <FeedbackBanner tone="danger" mode="dynamic">{errors.credentials}</FeedbackBanner>
                    )}

                    <div className="space-y-1.5">
                        <Label variant="plain" className="text-sm font-semibold text-ink-2">Email</Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="pm@empresa.com"
                            autoComplete="email"
                        />
                        {errors.email && <FieldError>{errors.email}</FieldError>}
                    </div>

                    <div className="space-y-1.5">
                        <Label variant="plain" className="text-sm font-semibold text-ink-2">Nueva contraseña</Label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="off"
                        />
                        {errors.password && <FieldError>{errors.password}</FieldError>}
                    </div>

                    <div className="space-y-1.5">
                        <Label variant="plain" className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
                            <Icon icon={KeyRound} className="text-ink-3" />
                            Token KunasPMS
                        </Label>
                        <Input
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="Dejar en blanco para no cambiarlo"
                            autoComplete="off"
                        />
                        {errors.token && <FieldError>{errors.token}</FieldError>}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={!canSave} loading={isSaving}>
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
