"use client"

import { Trash2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { useFormContext } from "react-hook-form"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { notifyError, normalizeApiError } from "@/lib/notify-error"
import { propertiesService, PROPERTY_IMAGE_LIMITS, extractPicturesUrl } from "../services/properties-service"
import { invalidatePropertiesCaches } from "../lib/properties-cache"
import {
    validatePropertyImages,
    ALLOWED_IMAGE_ACCEPT,
    ALLOWED_IMAGE_FORMATS_LABEL,
} from "../lib/property-image-validation"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { SectionCard } from "@/components/ui/section-card"
import { UploadZone } from "@/components/ui/upload-zone"
import { Badge } from "@/components/ui/badge"

/**
 * Property photo gallery, backed by the real images endpoints:
 *   POST   /properties/{uuid}/images   (multipart upload)
 *   DELETE /properties/{uuid}/images   (remove one URL)
 *
 * The gallery is only functional in EDIT mode, where the property already has a
 * UUID (watch("uuid")). During creation there's no property to attach images to,
 * so we show a hint to save first. The displayed list is always the backend's
 * `extra.picturesUrl` mirrored into the form field `picturesUrl`.
 */
export function PropertiesPhotos() {
    const { watch, setValue } = useFormContext()
    const uuid = watch("uuid") as string | undefined
    const picturesUrl = (watch("picturesUrl") as string[] | undefined) ?? []

    const [isUploading, setIsUploading] = useState(false)
    // El último lote que falló al subir: la zona ofrece «Reintentar» con los mismos archivos.
    const [failedBatch, setFailedBatch] = useState<{ files: File[]; message: string } | null>(null)
    // Borrar una foto se confirma (antes era al primer clic, con un botón que
    // solo aparecía al pasar el mouse). Mientras se borra no se cierra.
    const [photoToDelete, setPhotoToDelete] = useState<{ url: string; position: number; total: number } | null>(null)
    const [isDeletingPhoto, setIsDeletingPhoto] = useState(false)
    const deleteLockRef = useRef(false)

    /**
     * Mirror the backend gallery into the form. Critically, `thumbnailUrl` is kept
     * in sync with the first image (the cover): otherwise a stale thumbnail from a
     * deleted photo gets re-pushed into picturesUrl on "Actualizar Propiedad"
     * (see formDataToApiPayload) and the photo reappears after a reload.
     */
    function syncGallery(list: string[]) {
        setValue("picturesUrl", list, { shouldDirty: true })
        setValue("thumbnailUrl", list[0] ?? "", { shouldDirty: true })
    }

    async function uploadFiles(files: File[]) {
        if (files.length === 0 || !uuid) return

        // El guardarraíl del cliente; el backend revalida y tiene la última
        // palabra. Antes esto aceptaba cualquier `image/*`, así que un .avif se
        // subía y el 422 llegaba después de esperar la carga — sin decir qué
        // formatos sí se pueden usar.
        const failure = validatePropertyImages(files, PROPERTY_IMAGE_LIMITS)
        if (failure) {
            toast.error(failure.title, { description: failure.description })
            return
        }

        setFailedBatch(null)
        setIsUploading(true)
        try {
            const updated = await propertiesService.uploadImages(uuid, files)
            // La portada de la tarjeta cambió: la lista arranca limpia al volver.
            invalidatePropertiesCaches()
            syncGallery(extractPicturesUrl(updated))
            toast.success(files.length > 1 ? "Fotos subidas" : "Foto subida")
        } catch (err) {
            // Un solo aviso: el de la zona, con «Reintentar» sobre el mismo lote, y con
            // el mensaje real del backend (mismo normalizador que el toast).
            const { message } = normalizeApiError(err, files.length > 1 ? "No se pudieron subir las fotos." : "No se pudo subir la foto.")
            setFailedBatch({ files, message })
        } finally {
            setIsUploading(false)
        }
    }

    async function confirmRemoveImage() {
        if (!uuid || !photoToDelete || deleteLockRef.current) return
        deleteLockRef.current = true
        setIsDeletingPhoto(true)
        try {
            const updated = await propertiesService.deleteImage(uuid, photoToDelete.url)
            invalidatePropertiesCaches()
            syncGallery(extractPicturesUrl(updated))
            toast.success("Foto eliminada")
            setPhotoToDelete(null)
        } catch (err) {
            // El diálogo sigue abierto: se puede reintentar o cancelar.
            notifyError(err, "No pudimos eliminar la foto")
        } finally {
            deleteLockRef.current = false
            setIsDeletingPhoto(false)
        }
    }

    const photoLabel = (position: number, total: number) =>
        `foto ${position} de ${total}${position === 1 ? " (portada)" : ""}`

    return (
        <SectionCard
            title="Fotos"
            description="La primera foto es la portada. Sube fotos horizontales y nítidas: son lo primero que ve el huésped."
            headingLevel={2}
        >
            {!uuid ? (
                // Creation mode: no property UUID yet → nothing to attach images to.
                // Mismo aviso que automatizaciones y documentos (Fase 2.4).
                <FeedbackBanner tone="info" title="Guarda la propiedad primero para añadir fotos.">
                    La galería estará disponible al editar la propiedad.
                </FeedbackBanner>
            ) : (
                <div className="space-y-4">
                    {/* Los formatos se nombran ANTES de elegir el archivo: descubrirlos
                        por un rechazo es lo que hacía perder una carga entera. Sin
                        «N de M»: es una sola petición por lote. */}
                    <UploadZone
                        accept={ALLOWED_IMAGE_ACCEPT}
                        multiple
                        status={isUploading ? "uploading" : failedBatch ? "error" : "idle"}
                        title="Arrastra fotos aquí o haz clic para elegirlas"
                        hint={`${ALLOWED_IMAGE_FORMATS_LABEL} · hasta ${PROPERTY_IMAGE_LIMITS.maxPerUpload} por carga · 5 MB cada una`}
                        uploadingLabel="Subiendo fotos…"
                        errorMessage={failedBatch?.message}
                        onFiles={(files) => void uploadFiles(files)}
                        onRetry={failedBatch ? () => void uploadFiles(failedBatch.files) : undefined}
                        // Los que no pasan el filtro de formato se explican con el mismo
                        // mensaje de siempre (`validatePropertyImages`); los válidos sí suben.
                        onRejected={(rejected) => {
                            const failure = validatePropertyImages(rejected, PROPERTY_IMAGE_LIMITS)
                            toast.error(failure?.title ?? "Formato no admitido", { description: failure?.description ?? `Solo ${ALLOWED_IMAGE_FORMATS_LABEL}.` })
                        }}
                    />

                    {picturesUrl.length === 0 ? (
                        <p className="text-sm text-ink-3">Aún no hay fotos. La primera que subas será la portada.</p>
                    ) : (
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Fotos de la propiedad">
                            {picturesUrl.map((url, index) => (
                                <li
                                    key={url}
                                    className="relative aspect-video overflow-hidden rounded-lg border border-rule bg-sunk"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={`Foto ${index + 1} de ${picturesUrl.length} de la propiedad${index === 0 ? " (portada)" : ""}`}
                                        className="h-full w-full object-cover"
                                    />
                                    {index === 0 && (
                                        <Badge tone="surface" className="absolute bottom-1.5 left-1.5">Portada</Badge>
                                    )}
                                    {/* Siempre visible: con teclado y en pantallas táctiles no
                                        hay «pasar el mouse». 32 px, la densidad compacta. */}
                                    <Button variant="overlay" size="icon-sm"
                                        type="button"
                                        onClick={() => setPhotoToDelete({ url, position: index + 1, total: picturesUrl.length })}
                                        disabled={isUploading}
                                        className="absolute top-1.5 right-1.5"
                                        aria-label={`Eliminar ${photoLabel(index + 1, picturesUrl.length)}`}
                                    >
                                        <Icon icon={Trash2} />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <AlertDialog
                open={photoToDelete !== null}
                onOpenChange={(open) => { if (!open && !isDeletingPhoto) setPhotoToDelete(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta foto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se elimina la {photoToDelete ? photoLabel(photoToDelete.position, photoToDelete.total) : "foto"} de
                            la galería de la propiedad.
                            {/* La portada nueva la fija el formulario (`syncGallery`) y se
                                guarda con «Guardar cambios»: no se promete más que eso. */}
                            {photoToDelete?.position === 1 && (photoToDelete.total > 1
                                ? " Es la portada: al guardar la propiedad, la siguiente foto queda como portada."
                                : " Es la única foto: al guardar la propiedad, se queda sin portada.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {photoToDelete && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoToDelete.url} alt="" className="aspect-video w-full rounded-md border object-cover" />
                    )}
                    <AlertDialogFooter>
                        {/* Radix enfoca «Cancelar» al abrir: eliminar exige un clic deliberado. */}
                        <AlertDialogCancel disabled={isDeletingPhoto}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className={buttonVariants({ variant: "destructive" })}
                            keepOpen
                            pending={isDeletingPhoto}
                            pendingLabel="Eliminando…"
                            onClick={() => void confirmRemoveImage()}
                        >
                            Eliminar foto
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SectionCard>
    )
}
