"use client"

import { useCallback, useEffect, useState } from "react"
import {
    reservationsService,
    isVerifiedGuestStatus,
    type ReservationGuest,
    type ReservationGuestVerificationStatus,
} from "../services/reservations-service"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    FileText,
    Info,
    Loader2,
    Image as ImageIcon,
    RefreshCw,
    X,
} from "lucide-react"
import { AuthenticatedImage } from "./AuthenticatedImage"
import {
    describeDocumentOrigin,
    describeIdentityMethod,
    describeMissingImages,
} from "./identity-document-meta"

interface GuestDocumentsCardProps {
    reservationUuid: string
}

/**
 * El documento abierto en el modal. Lleva al huésped, no solo la URL, porque el
 * aviso de procedencia («esta foto es de otra estancia») solo tiene sentido
 * junto a la imagen que describe.
 */
interface DocumentPreview {
    url: string
    guest: ReservationGuest
    sideLabel: string
}

export function GuestDocumentsCard({ reservationUuid }: GuestDocumentsCardProps) {
    const [guests, setGuests] = useState<ReservationGuest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [preview, setPreview] = useState<DocumentPreview | null>(null)

    const refreshGuests = useCallback(async () => {
        setIsRefreshing(true)
        try {
            const data = await reservationsService.getGuests(reservationUuid)
            setGuests(data)
        } catch (error) {
            console.error("[GuestDocumentsCard] Error:", error)
        } finally {
            setIsRefreshing(false)
        }
    }, [reservationUuid])

    useEffect(() => {
        let active = true

        async function loadInitialGuests() {
            try {
                const data = await reservationsService.getGuests(reservationUuid)
                if (active) setGuests(data)
            } catch (error) {
                console.error("[GuestDocumentsCard] Error:", error)
            } finally {
                if (active) setIsLoading(false)
            }
        }

        void loadInitialGuests()

        const refreshWhenVisible = () => {
            if (document.visibilityState === "visible") void refreshGuests()
        }
        document.addEventListener("visibilitychange", refreshWhenVisible)
        return () => {
            active = false
            document.removeEventListener("visibilitychange", refreshWhenVisible)
        }
    }, [reservationUuid, refreshGuests])

    const refreshButton = (
        <button
            type="button"
            onClick={() => void refreshGuests()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-3 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Actualizar documentos y estados de huéspedes"
        >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Actualizar
        </button>
    )

    // El título de la sección no cambia entre estados: se declara una vez para
    // que cargando / vacío / con datos no puedan divergir.
    const description =
        guests.length > 0
            ? `${guests.length} ${guests.length === 1 ? "huésped registrado" : "huéspedes registrados"}`
            : undefined

    if (isLoading) {
        return (
            <SectionCard title="Documentos de huéspedes" actions={refreshButton}>
                <div className="flex items-center justify-center gap-2 py-8 text-ink-3">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Cargando…</span>
                </div>
            </SectionCard>
        )
    }

    if (guests.length === 0) {
        return (
            <SectionCard title="Documentos de huéspedes" actions={refreshButton}>
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <div className="rounded-full bg-sunk p-3 text-ink-4">
                        <FileText size={20} aria-hidden />
                    </div>
                    <p className="text-sm text-ink-3">
                        Aún no hay huéspedes registrados. Aparecerán aquí cuando completen el check-in.
                    </p>
                </div>
            </SectionCard>
        )
    }

    return (
        <>
            <SectionCard
                title="Documentos de huéspedes"
                description={description}
                actions={refreshButton}
            >
                <div className="space-y-4">
                    {guests.map((guest, idx) => (
                        <GuestDocumentRow
                            key={guest.uuid || `guest-${idx}`}
                            guest={guest}
                            onPreview={setPreview}
                        />
                    ))}
                </div>
            </SectionCard>

            {/* Image Preview Modal */}
            {preview && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setPreview(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Documento de ${preview.guest.name} — ${preview.sideLabel}`}
                >
                    <div className="relative max-w-3xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setPreview(null)}
                            aria-label="Cerrar"
                            className="absolute -top-10 right-0 text-white hover:text-slate-200 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                            <AuthenticatedImage
                                src={preview.url}
                                alt={`Documento de ${preview.guest.name} — ${preview.sideLabel}`}
                                className="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-2xl"
                            />
                            <DocumentOriginNotice guest={preview.guest} />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

/**
 * Aviso de procedencia del documento. No se pinta cuando la foto es de esta
 * misma reserva: ese es el caso normal y no merece tinta.
 */
function DocumentOriginNotice({ guest }: { guest: ReservationGuest }) {
    const notice = describeDocumentOrigin(guest.identityDocument)
    if (!notice) return null
    return (
        <div className="flex items-start gap-2 rounded-lg bg-info-sunk px-3 py-2 text-xs text-info">
            <Info size={14} aria-hidden className="mt-px shrink-0" />
            <span>{notice}</span>
        </div>
    )
}

function GuestDocumentRow({
    guest,
    onPreview,
}: {
    guest: ReservationGuest
    onPreview: (preview: DocumentPreview) => void
}) {
    const initials = `${guest.name?.[0] || ""}${guest.lastname?.[0] || ""}`.toUpperCase() || "?"
    const fullName = `${guest.name} ${guest.lastname}`.trim() || "Huésped"
    const hasDocuments = guest.documentImage1 || guest.documentImage2
    const isIdentityVerified = isVerifiedGuestStatus(guest.verificationStatus)
    const verifiedAt = formatVerifiedAt(guest.verifiedAt)
    const methodMeta = describeIdentityMethod(guest.identityDocument)

    return (
        <div className="space-y-3 rounded-xl border border-rule p-4">
            {/* Guest header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 bg-primary/10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink">{fullName}</span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                            {guest.isMain && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary">
                                    Principal
                                </Badge>
                            )}
                            {guest.identificationType && (
                                <span>{guest.identificationType}</span>
                            )}
                            {guest.identificationNumber && (
                                <span className="font-mono">{guest.identificationNumber}</span>
                            )}
                            {verifiedAt && <span>Verificado {verifiedAt}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                    {/* Cómo superó identidad EN esta reserva; puede diferir de quién
                        capturó la foto (el recurrente por OTP trae una de Didit). */}
                    {methodMeta && (
                        <StatusPill tone={methodMeta.tone}>{methodMeta.label}</StatusPill>
                    )}
                    <StatusBadge
                        completed={isIdentityVerified}
                        completedLabel="Identidad verificada"
                        pendingLabel={verificationPendingLabel(guest.verificationStatus)}
                    />
                    <StatusBadge
                        completed={guest.isCheckinCompleted}
                        completedLabel="Check-in completo"
                        pendingLabel="Check-in pendiente"
                    />
                </div>
            </div>

            {/* Document images */}
            {hasDocuments ? (
                <div className="grid grid-cols-2 gap-3">
                    {guest.documentImage1 && (
                        <DocumentThumbnail
                            url={guest.documentImage1}
                            label="Frente"
                            onClick={() => onPreview({ url: guest.documentImage1!, guest, sideLabel: "Frente" })}
                        />
                    )}
                    {guest.documentImage2 && (
                        <DocumentThumbnail
                            url={guest.documentImage2}
                            label="Reverso"
                            onClick={() => onPreview({ url: guest.documentImage2!, guest, sideLabel: "Reverso" })}
                        />
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 rounded-lg bg-sunk px-4 py-3">
                    <ImageIcon size={16} aria-hidden className="text-ink-4" />
                    <span className="text-xs text-ink-3">
                        {describeMissingImages(guest.identityDocument, isIdentityVerified)}
                    </span>
                </div>
            )}
        </div>
    )
}

function verificationPendingLabel(status: ReservationGuestVerificationStatus): string {
    if (status === "in_review") return "Identidad en revisión"
    if (status === "in_progress" || status === "pending") return "Verificación en proceso"
    if (status === "rejected" || status === "fail" || status === "expired") {
        return "Verificación con incidencia"
    }
    return "Identidad pendiente"
}

/**
 * Ahora delega en `StatusPill` en lugar de repintar su propio verde/ámbar: es
 * el mismo estado que muestran las automatizaciones justo encima, y con dos
 * paletas distintas se leía como si fueran cosas diferentes.
 */
function StatusBadge({
    completed,
    completedLabel,
    pendingLabel,
}: {
    completed: boolean
    completedLabel: string
    pendingLabel: string
}) {
    return (
        <StatusPill tone={completed ? "success" : "warning"}>
            {completed ? completedLabel : pendingLabel}
        </StatusPill>
    )
}

function formatVerifiedAt(value?: string | null): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

function DocumentThumbnail({
    url,
    label,
    onClick,
}: {
    url: string
    label: string
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="group relative aspect-3/2 overflow-hidden rounded-lg border border-rule bg-sunk transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <AuthenticatedImage
                src={url}
                alt={label}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
                {label}
            </span>
        </button>
    )
}
