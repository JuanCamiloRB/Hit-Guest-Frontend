"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Upload, X, Camera, Loader2, ImageIcon, Info } from "lucide-react"
import { useFormContext } from "react-hook-form"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { propertiesService, PROPERTY_IMAGE_LIMITS, extractPicturesUrl } from "../services/properties-service"

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
    const [deletingUrl, setDeletingUrl] = useState<string | null>(null)

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

    /** Client-side guardrails; the backend re-validates and is the final word. */
    function validate(files: File[]): string | null {
        if (files.length > PROPERTY_IMAGE_LIMITS.maxPerUpload) {
            return `Máximo ${PROPERTY_IMAGE_LIMITS.maxPerUpload} imágenes por carga.`
        }
        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                return `"${file.name}" no es una imagen.`
            }
            if (file.size > PROPERTY_IMAGE_LIMITS.maxBytes) {
                return `"${file.name}" supera los 5 MB.`
            }
        }
        return null
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files ? Array.from(e.target.files) : []
        // Reset the input so re-selecting the same file still fires onChange.
        e.target.value = ""
        if (files.length === 0 || !uuid) return

        const error = validate(files)
        if (error) {
            toast.error("No se pudo subir", { description: error })
            return
        }

        setIsUploading(true)
        try {
            const updated = await propertiesService.uploadImages(uuid, files)
            syncGallery(extractPicturesUrl(updated))
            toast.success(files.length > 1 ? "Fotos subidas" : "Foto subida")
        } catch (err) {
            notifyError(err, "No se pudieron subir las fotos")
        } finally {
            setIsUploading(false)
        }
    }

    async function removeImage(url: string) {
        if (!uuid) return
        setDeletingUrl(url)
        try {
            const updated = await propertiesService.deleteImage(uuid, url)
            syncGallery(extractPicturesUrl(updated))
            toast.success("Foto eliminada")
        } catch (err) {
            notifyError(err, "No se pudo eliminar la foto")
        } finally {
            setDeletingUrl(null)
        }
    }

    return (
        <Card>
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Camera className="h-5 w-5 text-[var(--color-brand-purple)]" />
                    Galería de Fotos
                </CardTitle>
                <CardDescription>
                    Sube fotos de alta calidad para atraer a más huéspedes. La primera imagen será la portada.
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
                        {picturesUrl.map((url) => (
                            <div
                                key={url}
                                className="aspect-video relative rounded-md overflow-hidden group border bg-slate-50"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="Foto de la propiedad" className="object-cover w-full h-full" />
                                {deletingUrl === url ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => removeImage(url)}
                                        disabled={isUploading}
                                        className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                                        aria-label="Eliminar foto"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
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
                                accept="image/*"
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
        </Card>
    )
}
