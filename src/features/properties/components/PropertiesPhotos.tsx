"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Upload, Trash2, Camera, Loader2, ImageIcon, Info } from "lucide-react"
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
import { notifyError } from "@/lib/notify-error"
import { propertiesService, PROPERTY_IMAGE_LIMITS, extractPicturesUrl } from "../services/properties-service"
import { invalidatePropertiesCaches } from "../lib/properties-cache"
import {
    validatePropertyImages,
    ALLOWED_IMAGE_ACCEPT,
    ALLOWED_IMAGE_FORMATS_LABEL,
} from "../lib/property-image-validation"

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
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [isUploading, setIsUploading] = useState(false)
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

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files ? Array.from(e.target.files) : []
        // Reset the input so re-selecting the same file still fires onChange.
        e.target.value = ""
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

        setIsUploading(true)
        try {
            const updated = await propertiesService.uploadImages(uuid, files)
            // La portada de la tarjeta cambió: la lista arranca limpia al volver.
            invalidatePropertiesCaches()
            syncGallery(extractPicturesUrl(updated))
            toast.success(files.length > 1 ? "Fotos subidas" : "Foto subida")
        } catch (err) {
            notifyError(err, "No se pudieron subir las fotos")
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
        <Card>
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Camera className="h-5 w-5 text-[var(--color-brand-purple)]" />
                    Galería de Fotos
                </CardTitle>
                <CardDescription>
                    Sube fotos de alta calidad para atraer a más huéspedes. La primera imagen será la portada.
                    <br />
                    {/* Los formatos se nombran ANTES de elegir el archivo: descubrirlos
                        por un rechazo es lo que hacía perder una carga entera. */}
                    <span className="font-medium text-slate-600">
                        Formatos: {ALLOWED_IMAGE_FORMATS_LABEL}
                    </span>
                    {" · "}
                    Máx. {PROPERTY_IMAGE_LIMITS.maxPerUpload} por carga · 5 MB c/u.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!uuid ? (
                    // Creation mode: no property UUID yet → nothing to attach images to.
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 py-12 text-center">
                        <Info className="h-6 w-6 text-slate-400" />
                        <p className="text-sm font-medium text-slate-600">
                            Guarda la propiedad primero para añadir fotos.
                        </p>
                        <p className="text-xs text-slate-400">
                            La galería estará disponible al editar la propiedad.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {picturesUrl.map((url, index) => (
                            <div
                                key={url}
                                className="aspect-video relative rounded-md overflow-hidden border bg-slate-50"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={url}
                                    alt={`Foto ${index + 1} de ${picturesUrl.length} de la propiedad${index === 0 ? " (portada)" : ""}`}
                                    className="object-cover w-full h-full"
                                />
                                {/* Siempre visible: con teclado y en pantallas táctiles no
                                    hay «pasar el mouse». 36 px de área táctil. */}
                                <button
                                    type="button"
                                    onClick={() => setPhotoToDelete({ url, position: index + 1, total: picturesUrl.length })}
                                    disabled={isUploading}
                                    className="absolute top-1.5 right-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60 disabled:opacity-40"
                                    aria-label={`Eliminar ${photoLabel(index + 1, picturesUrl.length)}`}
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                            </div>
                        ))}

                        {/* Upload tile */}
                        <div
                            className={`flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted/20 transition-colors ${
                                isUploading ? "cursor-wait opacity-70" : "hover:bg-muted/50 cursor-pointer"
                            }`}
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                multiple
                                accept={ALLOWED_IMAGE_ACCEPT}
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                disabled={isUploading}
                            />
                            <div className="flex flex-col items-center gap-2 text-muted-foreground pointer-events-none">
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                        <span className="text-sm">Subiendo…</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-8 w-8" />
                                        <span className="text-sm">Subir Fotos</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {picturesUrl.length === 0 && !isUploading && (
                            <div className="col-span-full flex items-center gap-2 text-xs text-slate-400 pt-1">
                                <ImageIcon className="h-4 w-4" />
                                Aún no hay fotos. Sube la primera para crear la portada.
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

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
                                guarda con «Actualizar Propiedad»: no se promete más que eso. */}
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
        </Card>
    )
}
