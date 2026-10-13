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
import { supportService } from "../services/support-service"
import { enterSupportSession } from "../lib/support-session"

export interface SupportTarget {
    uuid: string
    name: string
    email: string | null
    isAccountOwner: boolean
}

/** Mínimo del contrato (§4): el backend responde 422 en `errors.reason` por debajo. */
export const REASON_MIN = 10

export function supportReasonError(reason: string): string | null {
    return reason.trim().length < REASON_MIN
        ? `Explica el motivo con al menos ${REASON_MIN} caracteres (por ejemplo, «Ticket 77: revisar contrato»).`
        : null
}

/** Primer mensaje del backend para un campo de un 422, si lo trae. */
function fieldError(error: unknown, field: string): string | null {
    if (!(error instanceof ApiError) || error.status !== 422) return null
    const errors = error.errors
    if (!errors || Array.isArray(errors)) return null
    const messages = errors[field]
    return Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : null
}

type SubmitError = { field: "reason"; message: string } | { field: null; message: string }

/** Traduce un rechazo de `POST /support/sessions` (contrato §7) a qué mostrar y dónde. */
export function describeStartError(error: unknown): SubmitError & { userGone: boolean } {
    const reason = fieldError(error, "reason")
    if (reason) return { field: "reason", message: reason, userGone: false }
    const userUuid = fieldError(error, "userUuid")
    if (userUuid) return { field: null, message: userUuid, userGone: true }
    if (error instanceof ApiError && error.status === 429) {
        return { field: null, message: "Espera un momento e intenta de nuevo.", userGone: false }
    }
    // 403 `SUPPORT_TARGET_NOT_ALLOWED` y el resto: el `message` del backend.
    return { field: null, message: getErrorMessage(error, "No se pudo abrir la sesión de soporte."), userGone: false }
}

/**
 * Confirmación antes de entrar como un usuario. El motivo es obligatorio: queda
 * registrado en la sesión de soporte. La sesión tiene los MISMOS permisos del
 * usuario y todo queda a su nombre: se dice antes de entrar.
 */
export function StartSupportSessionDialog({
    open,
    onOpenChange,
    target,
    clientName,
    onUserGone,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    target: SupportTarget | null
    clientName: string
    /** 422 en `userUuid`: el usuario ya no existe; quien llama refresca la lista. */
    onUserGone: () => void
}) {
    const [reason, setReason] = useState("")
    const [touched, setTouched] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<SubmitError | null>(null)

    const localProblem = supportReasonError(reason)
    const reasonMessage = error?.field === "reason" ? error.message : touched ? localProblem : null

    const close = (next: boolean) => {
        if (submitting) return
        if (!next) {
            setReason("")
            setTouched(false)
            setError(null)
        }
        onOpenChange(next)
    }

    const submit = async () => {
        setTouched(true)
        if (!target || localProblem) return
        setSubmitting(true)
        setError(null)
        try {
            const started = await supportService.startSession({ userUuid: target.uuid, reason: reason.trim() })
            // Navega al panel del cliente: el diálogo no vuelve a pintarse.
            enterSupportSession(started)
        } catch (raw) {
            const described = describeStartError(raw)
            setError(described.field === "reason"
                ? { field: "reason", message: described.message }
                : { field: null, message: described.message })
            setSubmitting(false)
            if (described.userGone) onUserGone()
        }
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Entrar a la cuenta de {clientName}</DialogTitle>
                    <DialogDescription>
                        Verás el panel exactamente como <strong>{target?.name ?? "este usuario"}</strong>
                        {target?.isAccountOwner ? " (dueño de la cuenta)" : ""}, con sus mismos permisos. Todo lo que
                        hagas queda a su nombre. Tu sesión sigue abierta y vuelves a la consola al salir.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="support-reason">Motivo</Label>
                        <Textarea
                            id="support-reason"
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value)
                                if (error?.field === "reason") setError(null)
                            }}
                            onBlur={() => setTouched(true)}
                            placeholder="Ticket 77: revisar contrato"
                            rows={3}
                            aria-invalid={reasonMessage ? true : undefined}
                            aria-describedby="support-reason-help"
                        />
                        <p id="support-reason-help" className={reasonMessage ? "text-xs text-red-600" : "text-xs text-slate-500"}>
                            {reasonMessage ?? "Queda registrado en la sesión de soporte."}
                        </p>
                    </div>

                    {error?.field === null && (
                        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error.message}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => close(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void submit()} disabled={submitting || !target}>
                        {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogIn className="mr-1.5 h-4 w-4" />}
                        Entrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
