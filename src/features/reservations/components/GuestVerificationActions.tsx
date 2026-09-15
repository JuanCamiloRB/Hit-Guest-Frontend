"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RotateCcw, ShieldOff, Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { notifyError } from "@/lib/notify-error"
import { useAuthStore } from "@/lib/store/auth-store"
import {
    resolveGuestVerificationActions,
    waiverReasonError,
} from "../lib/guest-verification"
import { verificationPendingLabel } from "./identity-document-meta"
import {
    reservationsService,
    type ReservationGuest,
} from "../services/reservations-service"

/**
 * Acciones del PM sobre la verificación de UN huésped — contrato 2026-09-08/15
 * (skill `hitguest-api-contracts` §2c-bis).
 *
 * Qué se ofrece lo decide `resolveGuestVerificationActions` (árbol §5, puro y
 * testeado); acá vive solo el vocabulario y el transporte. Dos reglas del
 * contrato que este componente hace visibles:
 *
 * - «Exonerar» NO es un botón más: mete a una persona sin verificar en el
 *   reporte a Migración y en el contrato firmado. Confirmación explícita,
 *   motivo obligatorio (mínimo 10 caracteres, validado en cliente para no
 *   gastar el 422) y el estado actual de la verificación a la vista.
 * - Los errores del backend se muestran tal cual (`notifyError`): sus 422
 *   llegan localizados y con el detalle que el front no tiene.
 */
export function GuestVerificationActions({
    reservationUuid,
    guest,
    onChanged,
}: {
    reservationUuid: string
    guest: ReservationGuest
    /**
     * Recarga la ficha y responde si lo logró. Se ESPERA antes de soltar los
     * controles: el estado del huésped cambió en el backend, y habilitar los
     * botones sobre datos viejos invita a repetir una acción ya aplicada.
     */
    onChanged: () => Promise<boolean>
}) {
    const { user } = useAuthStore()
    // Sin dato explícito NO se es dueño: mostrar «Exonerar» a un staff que va a
    // recibir 403 es la peor de las dos fallas (el doc lo permite como plan B,
    // pero `isAccountOwner` ya viene en el GET /user del login).
    const isOwner = user?.isAccountOwner === true

    const [busy, setBusy] = useState<"reset" | "waive" | "revoke" | null>(null)
    const [waiveOpen, setWaiveOpen] = useState(false)
    const [revokeOpen, setRevokeOpen] = useState(false)
    const [reason, setReason] = useState("")
    const [reasonTouched, setReasonTouched] = useState(false)

    const actions = resolveGuestVerificationActions({
        isCompleted: guest.isCheckinCompleted,
        waiver: guest.identityWaiver,
        signals: guest.verificationSignals,
        isOwner,
    })

    if (!actions.showReset && !actions.showWaive && !actions.showRevoke) return null

    const reasonProblem = waiverReasonError(reason)

    /**
     * El refresco es parte de la acción, no un efecto suelto: si la mutación se
     * aplicó pero la ficha no se pudo recargar, el PM tiene que enterarse — si
     * no, lee en pantalla un estado que el backend ya no tiene.
     */
    const applied = async (message: string) => {
        toast.success(message)
        const reloaded = await onChanged()
        if (!reloaded) {
            toast.warning("La acción se aplicó, pero no pudimos recargar la ficha. Usa «Actualizar» para ver el estado real.")
        }
    }

    const handleReset = async () => {
        setBusy("reset")
        try {
            const message = await reservationsService.resetGuestVerification(reservationUuid, guest.uuid)
            await applied(message)
        } catch (error) {
            console.error("[GuestVerificationActions] reset:", error)
            notifyError(error, "No se pudo reiniciar la verificación")
        } finally {
            setBusy(null)
        }
    }

    const handleWaive = async () => {
        setReasonTouched(true)
        if (reasonProblem) return
        setBusy("waive")
        try {
            const message = await reservationsService.waiveGuestVerification(
                reservationUuid, guest.uuid, reason,
            )
            setWaiveOpen(false)
            setReason("")
            setReasonTouched(false)
            await applied(message)
        } catch (error) {
            console.error("[GuestVerificationActions] waiver:", error)
            notifyError(error, "No se pudo exonerar la verificación")
        } finally {
            setBusy(null)
        }
    }

    const handleRevoke = async () => {
        setBusy("revoke")
        try {
            const message = await reservationsService.revokeGuestVerificationWaiver(
                reservationUuid, guest.uuid,
            )
            setRevokeOpen(false)
            await applied(message)
        } catch (error) {
            console.error("[GuestVerificationActions] revoke:", error)
            notifyError(error, "No se pudo revocar la exoneración")
        } finally {
            setBusy(null)
        }
    }

    const fullName = `${guest.name} ${guest.lastname}`.trim() || "este huésped"
    const attempts = guest.verificationSignals.attemptsRemaining

    return (
        <div className="flex flex-wrap items-center gap-2">
            {actions.showReset && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={busy !== null}
                    onClick={() => void handleReset()}
                >
                    {busy === "reset"
                        ? <Loader2 size={13} className="animate-spin" />
                        : <RotateCcw size={13} aria-hidden />}
                    Reiniciar verificación
                </Button>
            )}

            {actions.showWaive && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-warning border-warning/40 hover:text-warning"
                    disabled={busy !== null}
                    onClick={() => setWaiveOpen(true)}
                >
                    <ShieldOff size={13} aria-hidden />
                    Exonerar verificación
                </Button>
            )}

            {actions.showRevoke && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={busy !== null}
                    onClick={() => setRevokeOpen(true)}
                >
                    {busy === "revoke"
                        ? <Loader2 size={13} className="animate-spin" />
                        : <RotateCcw size={13} aria-hidden />}
                    Revocar exoneración
                </Button>
            )}

            {/* ── Exonerar: confirmación con motivo obligatorio ── */}
            <Dialog open={waiveOpen} onOpenChange={(open) => { if (!busy) setWaiveOpen(open) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Exonerar la verificación de identidad</DialogTitle>
                        <DialogDescription>
                            {fullName} avanzará <strong>sin haber verificado su identidad</strong> y
                            quedará registrado como no verificado. Igual se reportará a las
                            autoridades con los datos que él mismo declaró.
                        </DialogDescription>
                    </DialogHeader>

                    {/* El estado que justifica la decisión, a la vista — que se decida
                        viendo el problema, no a ciegas (§6 del contrato). */}
                    <div className="flex items-start gap-2 rounded-lg bg-warning-sunk px-3 py-2 text-xs text-warning">
                        <TriangleAlert size={14} aria-hidden className="mt-px shrink-0" />
                        <span>
                            Estado actual: {verificationPendingLabel(guest.verificationStatus)}
                            {typeof attempts === "number" && ` · ${attempts === 0 ? "sin intentos restantes" : `${attempts} intento${attempts === 1 ? "" : "s"} restante${attempts === 1 ? "" : "s"}`}`}.
                            Quedará registrado quién autorizó y por qué.
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="waiver-reason" className="text-xs font-semibold">
                            Motivo (obligatorio)
                        </Label>
                        <Textarea
                            id="waiver-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            onBlur={() => setReasonTouched(true)}
                            placeholder="Ej.: el documento no fue legible para ningún proveedor; identidad confirmada en persona."
                            rows={3}
                            maxLength={1000}
                        />
                        {reasonTouched && reasonProblem && (
                            <p className="text-xs text-danger">{reasonProblem}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setWaiveOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={busy !== null || (reasonTouched && !!reasonProblem)}
                            onClick={() => void handleWaive()}
                        >
                            {busy === "waive" && <Loader2 size={14} className="animate-spin" />}
                            Exonerar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Revocar: confirmación simple ── */}
            <Dialog open={revokeOpen} onOpenChange={(open) => { if (!busy) setRevokeOpen(open) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Revocar la exoneración</DialogTitle>
                        <DialogDescription>
                            {fullName} volverá a quedar bloqueado hasta pasar la verificación de
                            identidad.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setRevokeOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={busy !== null}
                            onClick={() => void handleRevoke()}
                        >
                            {busy === "revoke" && <Loader2 size={14} className="animate-spin" />}
                            Revocar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
