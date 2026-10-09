"use client"

import { useState } from "react"
import { Loader2, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { getErrorMessage } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { adminService } from "../services/admin-service"
import { describeImpersonationError } from "../lib/admin-readers"
import { enterImpersonatedAccount } from "../lib/impersonation-session"
import type { ImpersonationMode } from "../lib/session-access"

export interface ImpersonationTarget {
    uuid: string
    name: string
    email: string | null
    isAccountOwner: boolean
}

export const REASON_MIN = 10
export const REASON_MAX = 500

/** Error de validación del motivo; `null` si es válido (contrato pedido §2.1: 10–500). */
export function impersonationReasonError(reason: string): string | null {
    const length = reason.trim().length
    if (length < REASON_MIN) return `Explica el motivo con al menos ${REASON_MIN} caracteres (por ejemplo, el ticket de soporte).`
    if (length > REASON_MAX) return `El motivo no puede superar los ${REASON_MAX} caracteres.`
    return null
}

/**
 * Confirmación antes de entrar a la cuenta de otro usuario. El motivo es
 * obligatorio porque queda en la auditoría de la sesión; sin él, la auditoría
 * no sirve. El modo con escritura solo se ofrece a quien tiene esa capacidad,
 * aunque el que decide es el backend.
 */
export function StartImpersonationDialog({
    open,
    onOpenChange,
    target,
    clientName,
    canWrite,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    target: ImpersonationTarget | null
    clientName: string
    canWrite: boolean
}) {
    const [reason, setReason] = useState("")
    const [touched, setTouched] = useState(false)
    const [mode, setMode] = useState<ImpersonationMode>("read_only")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reasonProblem = impersonationReasonError(reason)

    const close = (next: boolean) => {
        if (submitting) return
        if (!next) {
            setReason("")
            setTouched(false)
            setMode("read_only")
            setError(null)
        }
        onOpenChange(next)
    }

    const submit = async () => {
        setTouched(true)
        if (!target || reasonProblem) return
        setSubmitting(true)
        setError(null)
        try {
            const started = await adminService.startImpersonation({
                userUuid: target.uuid,
                mode: canWrite ? mode : "read_only",
                reason: reason.trim(),
            })
            // Navega a la cuenta del usuario: el diálogo no vuelve a pintarse.
            enterImpersonatedAccount(started)
        } catch (raw) {
            const code = raw instanceof ApiError ? raw.code : undefined
            setError(describeImpersonationError(code) ?? getErrorMessage(raw, "No se pudo entrar a la cuenta."))
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Entrar a la cuenta de {clientName}</DialogTitle>
                    <DialogDescription>
                        Verás exactamente lo que ve <strong>{target?.name ?? "este usuario"}</strong>
                        {target?.isAccountOwner ? " (dueño de la cuenta)" : ""}, con sus mismos permisos. Tu sesión
                        de superusuario sigue abierta y puedes volver en cualquier momento.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="impersonation-reason">Motivo</Label>
                        <Textarea
                            id="impersonation-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            onBlur={() => setTouched(true)}
                            placeholder="Ticket HG-1234: el cliente reporta que no ve sus reservas"
                            maxLength={REASON_MAX + 50}
                            rows={3}
                            aria-invalid={touched && reasonProblem ? true : undefined}
                            aria-describedby="impersonation-reason-help"
                        />
                        <div id="impersonation-reason-help" className="flex justify-between gap-3 text-xs">
                            <span className={touched && reasonProblem ? "text-red-600" : "text-slate-500"}>
                                {touched && reasonProblem ? reasonProblem : "Queda registrado en la auditoría de la sesión."}
                            </span>
                            <span className="shrink-0 text-slate-400">{reason.trim().length}/{REASON_MAX}</span>
                        </div>
                    </div>

                    {canWrite ? (
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-slate-700">Modo</legend>
                            <label className="flex items-start gap-2 text-sm text-slate-700">
                                <input
                                    type="radio"
                                    name="impersonation-mode"
                                    checked={mode === "read_only"}
                                    onChange={() => setMode("read_only")}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="font-medium">Solo lectura</span>
                                    <span className="block text-xs text-slate-500">No se puede enviar, cobrar ni borrar nada.</span>
                                </span>
                            </label>
                            <label className="flex items-start gap-2 text-sm text-slate-700">
                                <input
                                    type="radio"
                                    name="impersonation-mode"
                                    checked={mode === "full"}
                                    onChange={() => setMode("full")}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="font-medium">Con escritura</span>
                                    <span className="block text-xs text-slate-500">
                                        Puedes hacer cambios como este usuario. Cada cambio queda registrado a tu nombre.
                                    </span>
                                </span>
                            </label>
                        </fieldset>
                    ) : (
                        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            Entrarás en <strong>solo lectura</strong>: puedes ver todo, pero no enviar, cobrar ni borrar nada.
                        </p>
                    )}

                    {error && (
                        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => close(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void submit()} disabled={submitting || !target}>
                        {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogIn className="mr-1.5 h-4 w-4" />}
                        Entrar a la cuenta
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
