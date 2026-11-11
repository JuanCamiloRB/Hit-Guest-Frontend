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
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { notifyError } from "@/lib/notify-error"
import type { KunasConfigurationPayload } from "../types"
import {
    extractFieldErrors,
    isCredentialError,
    type IntegrationFieldErrors,
} from "../lib/integration-errors"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Label } from "@/components/ui/label"

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
    const [showPassword, setShowPassword] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [errors, setErrors] = useState<IntegrationFieldErrors>({})

    // Reset local state whenever the dialog opens so it reflects current data.
    function handleOpenChange(next: boolean) {
        if (next) {
            setEmail(currentEmail)
            setPassword("")
            setToken("")
            setErrors({})
            setShowPassword(false)
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
                        <div className="rounded-xl border border-danger/30 bg-danger-sunk px-4 py-3 text-sm font-medium text-danger">
                            {errors.credentials}
                        </div>
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
                        {errors.email && <p className="text-xs font-medium text-danger">{errors.email}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label variant="plain" className="text-sm font-semibold text-ink-2">Nueva contraseña</Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="off"
                                className="pr-10"
                            />
                            <UnstyledButton
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            >
                                {showPassword ? <Icon icon={EyeOff} /> : <Icon icon={Eye} />}
                            </UnstyledButton>
                        </div>
                        {errors.password && <p className="text-xs font-medium text-danger">{errors.password}</p>}
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
                        {errors.token && <p className="text-xs font-medium text-danger">{errors.token}</p>}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!canSave}
                    >
                        {isSaving && <Icon icon={Loader2} className="animate-spin" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
