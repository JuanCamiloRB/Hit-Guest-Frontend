"use client"

import { useState } from "react"
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

/**
 * El camino ESTRECHO para desbloquear TRA (contrato Airbnb iCal 2026-09-04 y
 * P0 de la auditoría del 2026-09-07): manda ÚNICAMENTE `{ totalPrice }`.
 *
 * El editor completo no sirve para esto: exige email/país/huéspedes que un
 * feed de iCal nunca trae, y su carga convertía `totalGuests: 0` (capacidad
 * sin declarar) en 1 — registrando de paso una capacidad que el huésped aún no
 * declaró. Un payload de un solo campo no puede pisar nada más.
 */
export function RegisterPriceDialog({
    reservationUuid,
    currency,
    open,
    onClose,
    onSaved,
}: {
    reservationUuid: string
    currency: string
    open: boolean
    onClose: () => void
    onSaved: () => void
}) {
    const [value, setValue] = useState("")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const parsed = Number(value)
    // 0 explícito es válido: una cortesía o la estadía del propietario valen 0
    // de verdad y tienen que poder reportarse.
    const canSave = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0

    const save = async () => {
        setSaving(true)
        setError(null)
        try {
            await reservationsService.update(reservationUuid, { totalPrice: parsed })
            toast.success("Valor registrado", {
                description: "El reporte a TRA ya puede ejecutarse — reintenta desde el panel de automatizaciones.",
            })
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
                    <DialogTitle>Registrar valor de la reserva</DialogTitle>
                    <DialogDescription>
                        El calendario de Airbnb no incluye el valor. Regístralo para que el
                        reporte a TRA pueda ejecutarse — solo se guarda el valor, nada más.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5 py-1">
                    <Label htmlFor="reservation-price">Valor total ({currency})</Label>
                    <Input
                        id="reservation-price"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Ej. 540000"
                        aria-invalid={error ? true : undefined}
                    />
                    <p className="text-xs text-slate-400">
                        Un valor de 0 también cuenta como confirmado (cortesías o estadías del
                        propietario).
                    </p>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={() => void save()} disabled={!canSave || saving}>
                        {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        Registrar valor
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
