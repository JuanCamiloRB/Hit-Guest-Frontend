"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { Upload } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"
import { cardSurface } from "./card"
import { FeedbackBanner } from "./feedback-banner"
import { FileInput } from "./file-input"
import { Icon } from "./icon"
import { Spinner } from "./loading-state"
import { UnstyledButton } from "./unstyled-button"

type UploadZoneStatus = "idle" | "uploading" | "error"

interface UploadZoneProps {
    /** El `id` del input de archivos (para un `Label htmlFor` externo). */
    id?: string
    /** Como el atributo nativo: tipos MIME, comodines (`image/*`) o extensiones (`.pdf`), separados por coma. */
    accept?: string
    multiple?: boolean
    disabled?: boolean
    status?: UploadZoneStatus
    /** Lo que invita a hacer. */
    title?: string
    /** Formatos y límites («JPG o PNG, hasta 10 MB»). */
    hint?: string
    /** Lo que dice mientras sube («Subiendo 5 fotos…»). Indeterminado: nunca «N de M». */
    uploadingLabel?: string
    /** Lo que falló; con `onRetry`, el aviso ofrece «Reintentar». */
    errorMessage?: string
    /** Los archivos que pasan el filtro de `accept` (solo si hay alguno). */
    onFiles: (files: File[]) => void
    onRetry?: () => void
    /** Los que no pasan el filtro (solo si hay alguno). */
    onRejected?: (rejected: File[]) => void
    /** Solo layout. */
    className?: string
}

/**
 * Si el archivo cabe en `accept`. Cada token es una extensión (`.pdf`), un
 * comodín de tipo (`image/*`) o un MIME exacto; sin `accept`, cabe todo.
 */
function matchesAccept(file: File, accept?: string) {
    const tokens = (accept ?? "")
        .split(",")
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean)
    if (tokens.length === 0) return true
    const type = file.type.toLowerCase()
    const name = file.name.toLowerCase()
    return tokens.some((token) => {
        if (token.startsWith(".")) return name.endsWith(token)
        if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1))
        return type === token
    })
}

/** Las mismas clases que `Surface dashed` (card.tsx no exporta `surfaceClasses`). */
const dashedSurface = cn(cardSurface, "border-2 border-dashed bg-sunk/50 shadow-none")

const uploadZoneVariants = cva(
    // El hueco punteado de `Surface dashed`; al arrastrar encima toma el morado.
    cn(
        dashedSurface,
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg px-4 py-8 text-center data-dragging:border-primary data-dragging:bg-primary/5 data-disabled:bg-sunk data-disabled:text-ink-3",
    ),
    {
        variants: {
            status: {
                idle: "cursor-pointer",
                uploading: "cursor-progress",
                error: "cursor-pointer border-danger/30",
            },
        },
        defaultVariants: { status: "idle" },
    },
)

/**
 * La zona de carga (fotos de un alojamiento, logo, documento del huésped):
 * un botón real con el aspecto de un hueco punteado y, como HERMANO, el
 * `FileInput` oculto que abre (`aria-controls`). Nunca un `<input>` dentro del
 * botón: Enter y Espacio ya los da el botón, y el input conserva su semántica.
 *
 * Arrastrar y soltar filtra igual que el selector: lo que cabe en `accept` va
 * a `onFiles`, el resto a `onRejected`. Sin `multiple`, de lo soltado se toma
 * el primero. El input se vacía tras cada elección para poder repetir el mismo
 * archivo.
 *
 * `status="uploading"` es indeterminado (spinner + `uploadingLabel`, `aria-busy`,
 * botón deshabilitado); `status="error"` muestra el aviso compacto debajo con
 * «Reintentar» si hay `onRetry`. Deshabilitada no abre ni acepta soltar.
 */
function UploadZone({
    id,
    accept,
    multiple = false,
    disabled = false,
    status = "idle",
    title = "Arrastra archivos aquí o haz clic para elegirlos",
    hint,
    uploadingLabel = "Subiendo…",
    errorMessage,
    onFiles,
    onRetry,
    onRejected,
    className,
}: UploadZoneProps) {
    const generatedId = React.useId()
    const inputId = id ?? `${generatedId}-file`
    const hintId = `${inputId}-hint`
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = React.useState(false)

    const uploading = status === "uploading"
    const inactive = disabled || uploading

    const handleFiles = (list: FileList | File[] | null | undefined) => {
        const files = Array.from(list ?? [])
        if (files.length === 0) return
        const accepted = files.filter((file) => matchesAccept(file, accept))
        const rejected = files.filter((file) => !matchesAccept(file, accept))
        const chosen = multiple ? accepted : accepted.slice(0, 1)
        if (chosen.length > 0) onFiles(chosen)
        if (rejected.length > 0) onRejected?.(rejected)
    }

    return (
        <div data-slot="upload-zone" data-status={status} className={cn("flex flex-col gap-2", className)}>
            <UnstyledButton
                type="button"
                data-slot="upload-zone-trigger"
                data-dragging={dragging || undefined}
                data-disabled={disabled || undefined}
                aria-controls={inputId}
                aria-describedby={hint && !uploading ? hintId : undefined}
                aria-busy={uploading || undefined}
                disabled={inactive}
                className={uploadZoneVariants({ status })}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                    // Sin preventDefault el navegador no permite soltar.
                    event.preventDefault()
                    if (inactive) return
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
                    if (!dragging) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    if (inactive) return
                    handleFiles(event.dataTransfer?.files)
                }}
            >
                {uploading ? (
                    <Spinner size="xl" tone="primary" />
                ) : (
                    <Icon icon={Upload} size="xl" className={disabled ? "text-ink-3" : "text-primary"} />
                )}
                <span data-slot="upload-zone-title" className="text-sm font-medium">
                    {uploading ? uploadingLabel : title}
                </span>
                {hint && !uploading && (
                    <span id={hintId} data-slot="upload-zone-hint" className="text-xs text-ink-3">
                        {hint}
                    </span>
                )}
            </UnstyledButton>
            <FileInput
                ref={inputRef}
                id={inputId}
                accept={accept}
                multiple={multiple}
                disabled={inactive}
                tabIndex={-1}
                onChange={(event) => {
                    handleFiles(event.target.files)
                    // Para que el mismo archivo se pueda volver a elegir.
                    event.target.value = ""
                }}
            />
            {status === "error" && errorMessage && (
                <FeedbackBanner
                    tone="danger"
                    mode="dynamic"
                    density="compact"
                    action={
                        onRetry && (
                            <Button variant="link" size="inline" onClick={onRetry}>
                                Reintentar
                            </Button>
                        )
                    }
                >
                    {errorMessage}
                </FeedbackBanner>
            )}
        </div>
    )
}

export { UploadZone, matchesAccept }
export type { UploadZoneProps, UploadZoneStatus }
