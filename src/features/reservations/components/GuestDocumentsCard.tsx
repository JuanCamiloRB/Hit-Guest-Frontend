"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
    reservationsService,
    type ReservationGuest,
    type ReservationGuestVerificationStatus,
} from "../services/reservations-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    FileText,
    Loader2,
    CheckCircle2,
    Clock,
    Image as ImageIcon,
    RefreshCw,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthenticatedImage } from "./AuthenticatedImage"

interface GuestDocumentsCardProps {
    reservationUuid: string
}

export function GuestDocumentsCard({ reservationUuid }: GuestDocumentsCardProps) {
    const [guests, setGuests] = useState<ReservationGuest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Actualizar documentos y estados de huéspedes"
        >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Actualizar
        </button>
    )

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-primary" />
                        Documentos de Huéspedes
                        {refreshButton}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Cargando...</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (guests.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-primary" />
                        Documentos de Huéspedes
                        {refreshButton}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-400 text-center py-6">
                        No hay huéspedes registrados aún
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-primary" />
                        Documentos de Huéspedes
                        <Badge variant="secondary" className="text-xs">
                            {guests.length} {guests.length === 1 ? "huésped" : "huéspedes"}
                        </Badge>
                        {refreshButton}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {guests.map((guest, idx) => (
                        <GuestDocumentRow
                            key={guest.uuid || `guest-${idx}`}
                            guest={guest}
                            onPreview={setPreviewUrl}
                        />
                    ))}
                </CardContent>
            </Card>

            {/* Image Preview Modal */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setPreviewUrl(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setPreviewUrl(null)}
                            className="absolute -top-10 right-0 text-white hover:text-slate-200 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <div onClick={(e) => e.stopPropagation()}>
                            <AuthenticatedImage
                                src={previewUrl}
                                alt="Documento"
                                className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function GuestDocumentRow({
    guest,
    onPreview,
}: {
    guest: ReservationGuest
    onPreview: (url: string) => void
}) {
    const initials = `${guest.name?.[0] || ""}${guest.lastname?.[0] || ""}`.toUpperCase() || "?"
    const fullName = `${guest.name} ${guest.lastname}`.trim() || "Huésped"
    const hasDocuments = guest.documentImage1 || guest.documentImage2
    const isIdentityVerified = isVerifiedStatus(guest.verificationStatus)
    const verifiedAt = formatVerifiedAt(guest.verifiedAt)

    return (
        <div className="border border-slate-100 rounded-xl p-4 space-y-3">
            {/* Guest header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 bg-primary/10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">{fullName}</span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
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
                            onClick={() => onPreview(guest.documentImage1!)}
                        />
                    )}
                    {guest.documentImage2 && (
                        <DocumentThumbnail
                            url={guest.documentImage2}
                            label="Reverso"
                            onClick={() => onPreview(guest.documentImage2!)}
                        />
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-lg">
                    <ImageIcon size={16} className="text-slate-300" />
                    <span className="text-xs text-slate-400">
                        {isIdentityVerified
                            ? "Identidad verificada; imágenes no disponibles"
                            : "Documentos aún no disponibles"}
                    </span>
                </div>
            )}
        </div>
    )
}

function isVerifiedStatus(status: ReservationGuestVerificationStatus): boolean {
    return status === "approved" || status === "completed" || status === "verified"
}

function verificationPendingLabel(status: ReservationGuestVerificationStatus): string {
    if (status === "in_review") return "Identidad en revisión"
    if (status === "in_progress" || status === "pending") return "Verificación en proceso"
    if (status === "rejected" || status === "fail" || status === "expired") {
        return "Verificación con incidencia"
    }
    return "Identidad pendiente"
}

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
        <Badge className={cn(
            "text-[10px] font-bold uppercase tracking-wide",
            completed
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : "bg-amber-50 text-amber-600 border-amber-100",
        )}>
            {completed ? (
                <><CheckCircle2 size={10} className="mr-1" /> {completedLabel}</>
            ) : (
                <><Clock size={10} className="mr-1" /> {pendingLabel}</>
            )}
        </Badge>
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
            className="relative group overflow-hidden rounded-lg border border-slate-200 hover:border-primary/20 transition-all aspect-[3/2] bg-slate-50"
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
