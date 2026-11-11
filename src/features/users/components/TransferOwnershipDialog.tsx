"use client"

import { useState } from "react"
import { Loader2, Crown } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { authService } from "@/features/auth/services/auth-service"
import type { User } from "@/features/auth/types"
import { FeedbackBanner } from "@/components/ui/feedback-banner"

interface TransferOwnershipDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    clientUuid: string | null
    /** Account users eligible to become owner (everyone except the current owner). */
    candidates: User[]
    /** Called after a successful transfer so the parent can refresh session + list. */
    onTransferred: () => void
}

/**
 * Owner-only flow to hand the account to another user. The target must already be
 * a member of the account (we only list users from GET /users). After a 200 the
 * caller loses ownership, so the parent refreshes the session immediately.
 */
export function TransferOwnershipDialog({
    open,
    onOpenChange,
    clientUuid,
    candidates,
    onTransferred,
}: TransferOwnershipDialogProps) {
    const [selectedUuid, setSelectedUuid] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const selectedName = candidates.find((c) => c.id === selectedUuid)?.firstName ?? "este usuario"

    const handleClose = (o: boolean) => {
        if (submitting) return
        if (!o) setSelectedUuid("")
        onOpenChange(o)
    }

    const handleConfirm = async () => {
        if (!clientUuid || !selectedUuid) return
        setSubmitting(true)
        try {
            await authService.transferOwnership(clientUuid, selectedUuid)
            toast.success("Propiedad transferida", {
                description: `${selectedName} ahora es el dueño de la cuenta.`,
            })
            setSelectedUuid("")
            onTransferred()
            onOpenChange(false)
        } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
                toast.error("Solo el dueño actual puede transferir la cuenta.")
            } else if (error instanceof ApiError && error.status === 422) {
                toast.error("El usuario seleccionado no es válido para la transferencia.")
            } else {
                notifyError(error, "No se pudo transferir la propiedad")
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-110">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon icon={Crown} size="lg" className="text-warning" />
                        Transferir propiedad de la cuenta
                    </DialogTitle>
                    <DialogDescription>
                        El usuario que elijas se convertirá en el nuevo dueño de la cuenta.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-ink-2">Nuevo dueño</Label>
                        <Select value={selectedUuid} onValueChange={setSelectedUuid} disabled={submitting}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un usuario" />
                            </SelectTrigger>
                            <SelectContent>
                                {candidates.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.firstName} · {u.email}
                                    </SelectItem>
                                ))}
                                {candidates.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-ink-3">
                                        No hay otros usuarios en la cuenta. Crea uno primero.
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <FeedbackBanner tone="warning" density="compact">
                        Dejarás de ser el dueño. No podrás deshacer esto tú mismo: solo el nuevo dueño
                        podrá transferírtela de vuelta. Conservarás tu rol de Administrador.
                    </FeedbackBanner>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={submitting || !selectedUuid || !clientUuid}
                    >
                        {submitting && <Icon icon={Loader2} className="mr-2 animate-spin" />}
                        Transferir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
