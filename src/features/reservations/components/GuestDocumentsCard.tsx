"use client"

import React, { useEffect, useState } from "react"
import { reservationsService, ReservationGuest } from "../services/reservations-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    FileText,
    Loader2,
    CheckCircle2,
    Clock,
    User,
    Image as ImageIcon,
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
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const data = await reservationsService.getGuests(reservationUuid)
                if (mounted) setGuests(data)
            } catch (error) {
                console.error("[GuestDocumentsCard] Error:", error)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [reservationUuid])

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-500" />
                        Documentos de Huéspedes
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
                        <FileText size={18} className="text-indigo-500" />
                        Documentos de Huéspedes
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
                        <FileText size={18} className="text-indigo-500" />
                        Documentos de Huéspedes
                        <Badge variant="secondary" className="ml-auto text-xs">
                            {guests.length} {guests.length === 1 ? "huésped" : "huéspedes"}
                        </Badge>
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
    const isVerified = guest.verificationStatus === "verified" || guest.isCheckinCompleted

    return (
        <div className="border border-slate-100 rounded-xl p-4 space-y-3">
            {/* Guest header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 bg-indigo-50">
                        <AvatarFallback className="bg-indigo-50 text-indigo-600 text-xs font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">{fullName}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            {guest.isMain && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-200 text-indigo-500">
                                    Principal
                                </Badge>
                            )}
                            {guest.identificationType && (
                                <span>{guest.identificationType}</span>
                            )}
                            {guest.identificationNumber && (
                                <span className="font-mono">{guest.identificationNumber}</span>
                            )}
                        </div>
                    </div>
                </div>
                <Badge className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    isVerified
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                    {isVerified ? (
                        <><CheckCircle2 size={10} className="mr-1" /> Verificado</>
                    ) : (
                        <><Clock size={10} className="mr-1" /> Pendiente</>
                    )}
                </Badge>
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
                        {isVerified ? "Verificado (sin imágenes locales)" : "Documentos no subidos aún"}
                    </span>
                </div>
            )}
        </div>
    )
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
            className="relative group overflow-hidden rounded-lg border border-slate-200 hover:border-indigo-300 transition-all aspect-[3/2] bg-slate-50"
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
