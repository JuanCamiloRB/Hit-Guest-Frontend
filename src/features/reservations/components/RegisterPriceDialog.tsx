"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ApiError } from "@/types/api"
import { reservationsService } from "../services/reservations-service"
import { automationService } from "@/features/properties/services/automation-service"
import { classifyRecord } from "@/features/billing/lib/pricing"

/**
 * ¿Ya salió el reporte a TRA con el valor anterior? (contrato 2026-09-27 §2.2)
 * Cuatro estados a propósito: «no se pudo saber» NO es «no se envió». Mientras
 * se consulta, en modo corrección no se puede guardar; si la consulta falla,
 * se dice que no se pudo comprobar y nunca se afirma que el nuevo valor va a
 * llegar al Ministerio.
 *
 * La fuente es el HISTORIAL (`/automation-records`), no `/automation-status`:
 * este último trae una fila por automatización ACTIVA, así que una TRA
 * desactivada después de reportar desaparecía de la lista y el diálogo
 * afirmaba «no enviado» sobre un reporte que ya está en el Ministerio.
 */
type TraReportStatus = "loading" | "sent" | "not_sent" | "unknown"

/** `100.1234` no puede viajar: el backend acepta hasta dos decimales. Cero sí (cortesías). */
const PM_PRICE_PATTERN = /^\d+(\.\d{1,2})?$/

/**
 * El camino ESTRECHO para desbloquear TRA (contrato Airbnb iCal 2026-09-04 y
 * P0 de la auditoría del 2026-09-07): manda ÚNICAMENTE `{ totalPrice }`.
 *
 * El editor completo no sirve para esto: exige email/país/huéspedes que un
 * feed de iCal nunca trae, y su carga convertía `totalGuests: 0` (capacidad
 * sin declarar) en 1 — registrando de paso una capacidad que el huésped aún no
 * declaró. Un payload de un solo campo no puede pisar nada más.
 *
 * Quien lo monta lo hace solo mientras está abierto (`{open && <Dialog/>}`):
 * el estado nace fresco en cada apertura con el valor vigente, sin efectos que
 * sincronicen props a estado.
 */
export function RegisterPriceDialog({
    reservationUuid,
    currency,
    open,
    onClose,
    onSaved,
    mode = "register",
    initialValue = null,
}: {
    reservationUuid: string
    /** `null` = la reserva no informó moneda; se avisa, no se inventa COP. */
    currency: string | null
    open: boolean
    onClose: () => void
    onSaved: () => void
    /**
     * `register`: la reserva no tiene valor (aviso «Falta registrar»).
     * `correct`: ya tiene uno —hoy, el que declaró el huésped (contrato
     * 2026-09-27 §2.2)— y el PM lo corrige. Mismo PUT de un solo campo.
     */
    mode?: "register" | "correct"
    /** Valor vigente, precargado en modo `correct`. */
    initialValue?: number | null
}) {
    const [value, setValue] = useState(() => mode === "correct" && initialValue != null ? String(initialValue) : "")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // En registro TRA no pudo correr (justamente falta el valor): no hay nada que consultar.
    const [traStatus, setTraStatus] = useState<TraReportStatus>(mode === "correct" ? "loading" : "not_sent")

    useEffect(() => {
        if (!open || mode !== "correct") return
        let active = true
        automationService.listUsageRecords(reservationUuid)
            .then((records) => {
                if (!active) return
                const sent = records.some((record) =>
                    classifyRecord(record.providerSlug, record.automationName) === "tra" && record.status === "completed",
                )
                setTraStatus(sent ? "sent" : "not_sent")
            })
            .catch(() => { if (active) setTraStatus("unknown") })
        return () => { active = false }
    }, [open, mode, reservationUuid])

    const trimmed = value.trim()
    const parsed = Number(trimmed)
    const hasValidScale = PM_PRICE_PATTERN.test(trimmed)
    // 0 explícito es válido: una cortesía o la estadía del propietario valen 0
    // de verdad y tienen que poder reportarse.
    const isValidValue = trimmed !== "" && hasValidScale && Number.isFinite(parsed) && parsed >= 0
    const scaleError = trimmed !== "" && !hasValidScale
        ? "Escribe un valor con máximo dos decimales, usando punto (por ejemplo 540000 o 540000.50)."
        : null
    const canSave = isValidValue && traStatus !== "loading"

    const save = async () => {
        setSaving(true)
        setError(null)
        try {
            await reservationsService.update(reservationUuid, { totalPrice: parsed })
            if (mode === "correct") {
                toast.success("Valor actualizado", { description: correctionOutcome(traStatus) })
            } else {
                toast.success("Valor registrado", {
                    description: "El reporte a TRA ya puede ejecutarse — reintenta desde el panel de automatizaciones.",
                })
            }
            onSaved()
            onClose()
        } catch (raw) {
            const message = raw instanceof ApiError && raw.message
                ? raw.message
                : "No se pudo registrar el valor. Inténtalo de nuevo."
            setError(message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{mode === "correct" ? "Corregir valor de la reserva" : "Registrar valor de la reserva"}</DialogTitle>
                    <DialogDescription>
                        {mode === "correct"
                            ? "El valor vigente lo declaró el huésped principal al identificarse. Si no coincide con la reserva, corrígelo aquí — solo se guarda el valor, nada más."
                            : "El calendario de Airbnb no incluye el valor. Regístralo para que el reporte a TRA pueda ejecutarse — solo se guarda el valor, nada más."}
                    </DialogDescription>
                </DialogHeader>

                {mode === "correct" && traStatus === "loading" && (
                    <p className="flex items-center gap-2 text-xs text-ink-3" role="status">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Comprobando si el reporte a TRA ya se envió…
                    </p>
                )}
                {traStatus === "sent" && (
                    <p className="rounded-lg bg-warning-sunk px-3 py-2 text-xs text-warning" role="status">
                        El reporte a TRA ya se envió con el valor anterior; este cambio no lo modifica.
                    </p>
                )}
                {traStatus === "unknown" && (
                    <p className="rounded-lg bg-warning-sunk px-3 py-2 text-xs text-warning" role="status">
                        No pudimos comprobar si el reporte a TRA ya se envió. Si ya salió, este cambio no lo modifica.
                    </p>
                )}

                <div className="space-y-1.5 py-1">
                    <Label htmlFor="reservation-price">
                        Valor total{currency ? ` (${currency})` : ""}
                    </Label>
                    <Input
                        id="reservation-price"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Ej. 540000"
                        aria-invalid={error || scaleError ? true : undefined}
                    />
                    {!currency && (
                        <p className="text-xs text-warning">
                            La reserva no informa su moneda: el valor se guarda sin moneda conocida.
                        </p>
                    )}
                    <p className="text-xs text-slate-400">
                        Un valor de 0 también cuenta como confirmado (cortesías o estadías del
                        propietario).
                    </p>
                    {scaleError && <p className="text-xs text-red-500">{scaleError}</p>}
                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={() => void save()} disabled={!canSave || saving}>
                        {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        {mode === "correct" ? "Guardar valor" : "Registrar valor"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/** Qué le pasa al reporte a TRA con la corrección, según lo que se pudo saber. */
function correctionOutcome(status: TraReportStatus): string {
    switch (status) {
        case "sent":
            return "El reporte a TRA ya enviado conserva el valor anterior."
        case "not_sent":
            return "Es el valor que se usará al reportar a TRA."
        default:
            return "Revisa en el panel de automatizaciones si el reporte a TRA ya se había enviado."
    }
}
