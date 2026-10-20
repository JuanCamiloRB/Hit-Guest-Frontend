"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
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

/** Una foto elegida y su vista previa local (`blob:`), que hay que liberar. */
interface PickedPhoto {
    file: File
    url: string
}

/** Contrato: solo jpg, jpeg o png. Se avisa antes de enviar en vez de esperar el 422. */
function fileTypeError(photo: PickedPhoto | null): string | null {
    return photo && !ACCEPTED_TYPES.includes(photo.file.type) ? "Solo imágenes JPG o PNG." : null
}

function PhotoField({
    id,
    label,
    hint,
    photo,
    error,
    disabled,
    onPick,
    onRemove,
}: {
    id: string
    label: string
    hint: string
    photo: PickedPhoto | null
    error: string | null
    disabled: boolean
    onPick: (file: File | null) => void
    /** Solo para lo opcional: el frente se cambia eligiendo otra foto. */
    onRemove?: () => void
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
                {onRemove && photo && (
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
                    >
                        <X size={12} aria-hidden /> Quitar
                    </button>
                )}
            </div>
            <label
                htmlFor={id}
                className={cn(
                    "flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 text-sm text-slate-500 transition-colors hover:bg-slate-100",
                    error ? "border-red-300" : "border-slate-200",
                    disabled && "cursor-not-allowed opacity-60",
                )}
            >
                {photo
                    // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image
                    ? <img src={photo.url} alt={`Vista previa: ${label}`} className="h-full w-full object-contain" />
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
                onChange={(event) => {
                    onPick(event.target.files?.[0] ?? null)
                    // Permite volver a elegir el mismo archivo después de quitarlo.
                    event.target.value = ""
                }}
            />
            {/* `role="alert"` solo con error: el lector de pantalla lo anuncia al aparecer. */}
            <p
                id={`${id}-help`}
                role={error ? "alert" : undefined}
                className={error ? "text-xs text-red-600" : "text-xs text-slate-500"}
            >
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
    const [front, setFront] = useState<PickedPhoto | null>(null)
    const [back, setBack] = useState<PickedPhoto | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<WaiverUploadErrorView>(NO_ERRORS)
    const fullName = `${guest.name} ${guest.lastname}`.trim() || "este huésped"

    // Las URLs `blob:` se crean al ELEGIR (un manejador, no el render) y se
    // liberan al cambiar, quitar, cerrar o desmontar. El ref permite liberarlas
    // al desmontar sin depender del estado de ese render.
    const livePhotos = useRef<{ front: PickedPhoto | null; back: PickedPhoto | null }>({ front: null, back: null })
    useEffect(() => () => {
        for (const photo of Object.values(livePhotos.current)) if (photo) URL.revokeObjectURL(photo.url)
    }, [])

    const setPhoto = (side: "front" | "back", file: File | null) => {
        const previous = livePhotos.current[side]
        if (previous) URL.revokeObjectURL(previous.url)
        const next = file ? { file, url: URL.createObjectURL(file) } : null
        livePhotos.current[side] = next
        if (side === "front") setFront(next)
        else setBack(next)
        setErrors((current) => ({ ...current, [side]: null, form: null }))
    }

    const reset = () => {
        setPhoto("front", null)
        setPhoto("back", null)
        setErrors(NO_ERRORS)
    }

    const close = (next: boolean) => {
        if (submitting) return
        if (!next) reset()
        onOpenChange(next)
    }

    const frontProblem = errors.front ?? fileTypeError(front)
    const backProblem = errors.back ?? fileTypeError(back)

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (submitting) return
        if (!front) {
            setErrors({ ...NO_ERRORS, front: "Sube la foto del frente del documento." })
            return
        }
        if (fileTypeError(front) || fileTypeError(back)) return
        setSubmitting(true)
        setErrors(NO_ERRORS)
        try {
            const result = await reservationsService.uploadWaivedGuestDocuments(reservationUuid, guest.uuid, {
                front: front.file,
                back: back?.file ?? null,
            })
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
                <form onSubmit={(event) => void submit(event)} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Subir el documento de {fullName}</DialogTitle>
                        <DialogDescription>
                            Las fotos quedan en esta reserva y en el reporte PDF. No verifican la identidad: el
                            huésped sigue exonerado. Si ya había fotos, estas las reemplazan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <PhotoField
                            id="waiver-front"
                            label="Frente"
                            hint="Obligatorio."
                            photo={front}
                            error={frontProblem}
                            disabled={submitting}
                            onPick={(file) => setPhoto("front", file)}
                        />
                        <PhotoField
                            id="waiver-back"
                            label="Reverso"
                            hint="Si el documento lo tiene (la cédula sí, el pasaporte no)."
                            photo={back}
                            error={backProblem}
                            disabled={submitting}
                            onPick={(file) => setPhoto("back", file)}
                            onRemove={() => setPhoto("back", null)}
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
                        <Button type="button" variant="outline" onClick={() => close(false)} disabled={submitting}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting
                                ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Procesando las fotos…</>
                                : "Subir fotos"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
