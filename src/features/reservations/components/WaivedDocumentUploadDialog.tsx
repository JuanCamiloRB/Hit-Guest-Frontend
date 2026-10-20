"use client"

import { useEffect, useMemo, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ReservationGuest } from "../services/reservations-service"
import { reservationsService } from "../services/reservations-service"
import { describeWaiverUploadError, type WaiverUploadErrorView } from "../lib/waiver-document-upload"

const ACCEPTED_TYPES = ["image/jpeg", "image/png"]
const NO_ERRORS: WaiverUploadErrorView = { front: null, back: null, form: null, refresh: false }

/** Contrato: solo jpg, jpeg o png. Se avisa antes de enviar en vez de esperar el 422. */
function fileTypeError(file: File | null): string | null {
    return file && !ACCEPTED_TYPES.includes(file.type) ? "Solo imágenes JPG o PNG." : null
}

function PhotoField({
    id,
    label,
    hint,
    file,
    error,
    disabled,
    onChange,
}: {
    id: string
    label: string
    hint: string
    file: File | null
    error: string | null
    disabled: boolean
    onChange: (file: File | null) => void
}) {
    // La URL se deriva del archivo; el efecto solo la libera al cambiar o desmontar.
    const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
            <label
                htmlFor={id}
                className={cn(
                    "flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 text-sm text-slate-500 transition-colors hover:bg-slate-100",
                    error ? "border-red-300" : "border-slate-200",
                    disabled && "cursor-not-allowed opacity-60",
                )}
            >
                {preview
                    // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image
                    ? <img src={preview} alt={`Vista previa: ${label}`} className="h-full w-full object-contain" />
                    : <span className="flex items-center gap-2"><ImagePlus size={16} aria-hidden /> Elegir foto</span>}
            </label>
            <input
                id={id}
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-help`}
                onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            />
            <p id={`${id}-help`} className={error ? "text-xs text-red-600" : "text-xs text-slate-500"}>
                {error ?? hint}
            </p>
        </div>
    )
}

/**
 * El PM sube las fotos del documento de un huésped EXONERADO (contrato
 * 2026-10-15). No verifica nada: el huésped sigue exonerado. El servidor
 * endereza y recorta, y tarda unos segundos — sin doble envío.
 */
export function WaivedDocumentUploadDialog({
    open,
    onOpenChange,
    reservationUuid,
    guest,
    onUploaded,
    onStale,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    reservationUuid: string
    guest: Pick<ReservationGuest, "uuid" | "name" | "lastname">
    /** La fila que devolvió el backend; `null` si no vino (quien llama refresca). */
    onUploaded: (guest: ReservationGuest | null) => void
    /** El huésped o la exoneración ya no existen: hay que refrescar la ficha. */
    onStale: () => void
}) {
    const [front, setFront] = useState<File | null>(null)
    const [back, setBack] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<WaiverUploadErrorView>(NO_ERRORS)
    const fullName = `${guest.name} ${guest.lastname}`.trim() || "este huésped"

    const reset = () => {
        setFront(null)
        setBack(null)
        setErrors(NO_ERRORS)
    }

    const close = (next: boolean) => {
        if (submitting) return
        if (!next) reset()
        onOpenChange(next)
    }

    const frontProblem = errors.front ?? fileTypeError(front)
    const backProblem = errors.back ?? fileTypeError(back)

    const submit = async () => {
        if (!front) {
            setErrors({ ...NO_ERRORS, front: "Sube la foto del frente del documento." })
            return
        }
        if (fileTypeError(front) || fileTypeError(back)) return
        setSubmitting(true)
        setErrors(NO_ERRORS)
        try {
            const result = await reservationsService.uploadWaivedGuestDocuments(reservationUuid, guest.uuid, { front, back })
            toast.success(result.message, {
                description: "Si ya se envió el reporte PDF de huéspedes, reenvíalo desde Automatizaciones para que incluya las fotos.",
            })
            onUploaded(result.guest)
            setSubmitting(false)
            reset()
            onOpenChange(false)
        } catch (error) {
            const view = describeWaiverUploadError(error)
            setErrors(view)
            setSubmitting(false)
            if (view.refresh) onStale()
        }
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Subir el documento de {fullName}</DialogTitle>
                    <DialogDescription>
                        Las fotos quedan en esta reserva y en el reporte PDF. No verifican la identidad: el huésped
                        sigue exonerado. Si ya había fotos, estas las reemplazan.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <PhotoField
                        id="waiver-front"
                        label="Frente"
                        hint="Obligatorio."
                        file={front}
                        error={frontProblem}
                        disabled={submitting}
                        onChange={(file) => { setFront(file); setErrors((e) => ({ ...e, front: null, form: null })) }}
                    />
                    <PhotoField
                        id="waiver-back"
                        label="Reverso"
                        hint="Si el documento lo tiene (la cédula sí, el pasaporte no)."
                        file={back}
                        error={backProblem}
                        disabled={submitting}
                        onChange={(file) => { setBack(file); setErrors((e) => ({ ...e, back: null, form: null })) }}
                    />
                </div>

                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Sube cada cara en su propia imagen, JPG o PNG. Si te mandaron un PDF o una sola imagen con
                    las dos caras, toma un pantallazo de cada una.
                </p>

                {errors.form && (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => close(false)} disabled={submitting}>Cancelar</Button>
                    <Button onClick={() => void submit()} disabled={submitting}>
                        {submitting
                            ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Procesando las fotos…</>
                            : "Subir fotos"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
