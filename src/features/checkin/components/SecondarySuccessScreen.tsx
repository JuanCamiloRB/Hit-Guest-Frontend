"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { CheckCircle2, MapPin, CalendarDays, Home } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useSearchParams } from "next/navigation"
import { completedEntryCopy, resolveCompletedEntryReason } from "@/features/checkin/lib/success-entry"
import { Heading } from "@/components/ui/heading"

interface SecondarySuccessScreenProps {
    portal: CheckinPortalResponse
    reservationUuid: string
}

export function SecondarySuccessScreen({ portal, reservationUuid }: SecondarySuccessScreenProps) {
    const res = portal.reservation;
    const searchParams = useSearchParams()
    const completedEntryReason = resolveCompletedEntryReason(
        searchParams.get("entry"),
        searchParams.get("guest_uuid"),
        portal.registeredGuests,
    )
    const completedCopy = completedEntryReason ? completedEntryCopy(completedEntryReason) : null

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={3} totalSteps={3} isSuccess />

            <div className="flex flex-col items-center justify-center text-center mt-6 space-y-4">
                <div className="h-20 w-20 bg-success-sunk rounded-full flex items-center justify-center mb-2">
                    <Icon icon={CheckCircle2} size="3xl" className="text-success" />
                </div>
                <Heading level={1}>
                    {completedCopy?.title ?? "¡Registro Exitoso!"}
                </Heading>
                <p className="text-ink-3 text-sm max-w-sm">
                    {completedCopy?.description ?? "Tus datos han sido registrados correctamente."}
                </p>
            </div>

            <div className="bg-white border border-rule rounded-xl p-5 shadow-sm space-y-4">
                <Heading level={3} size="subsection">Resumen de Estadía</Heading>
                
                <div className="flex items-start gap-3">
                    <Icon icon={MapPin} size="lg" className="text-primary" />
                    <div>
                        <p className="text-sm font-semibold text-ink">Tu alojamiento</p>
                        <p className="text-xs text-ink-3">{res.uuid.slice(0, 8)}...</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Icon icon={CalendarDays} size="lg" className="text-primary" />
                    <div>
                        <p className="text-sm font-semibold text-ink">
                            {res.arrivalDate} — {res.departureDate}
                        </p>
                        <p className="text-xs text-ink-3">{res.totalGuestsAllowed} huéspedes permitidos</p>
                    </div>
                </div>
            </div>

            <div className="bg-brand-navy/5 border border-brand-navy/10 rounded-xl p-5 text-center">
                <p className="text-sm text-brand-navy font-medium">
                    El huésped titular tiene acceso a las instrucciones de llegada y códigos de cerradura.
                </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-rule/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <Button asChild size="xl">
                        <Link
                            href={`/checkin/${reservationUuid}`}
                            className="w-full"
                        >
                            <Icon icon={Home} size="lg" />
                            Volver al inicio
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
