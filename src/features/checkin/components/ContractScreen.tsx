"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { StepIndicator } from "@/features/checkin/components/StepIndicator"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { SignaturePad } from "@/features/checkin/components/SignaturePad"
import type { ContractTemplate, GuestFormData, CompleteMainGuestPayload } from "@/features/checkin/types/checkin"
import { MAIN_GUEST_STEPS } from "@/features/checkin/data/constants"

export function ContractScreen({ reservationUuid, basePath }: { reservationUuid: string, basePath: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const guestUuid = searchParams.get("guest_uuid") || ""

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [template, setTemplate] = useState<ContractTemplate | null>(null)
    const [signature, setSignature] = useState<string | null>(null)
    const [accepted, setAccepted] = useState(false)

    useEffect(() => {
        if (!guestUuid) {
            router.push(`${basePath}/identify`)
            return
        }
        
        checkinService.getContractTemplate(reservationUuid)
            .then(data => {
                setTemplate(data)
                setIsLoading(false)
            })
            .catch(err => {
                toast.error("Error al cargar el contrato")
                setIsLoading(false)
            })
    }, [reservationUuid, guestUuid, basePath, router])

    const handleComplete = async () => {
        if (!signature || !accepted) return

        setIsSubmitting(true)
        try {
            // Read form data saved from GuestFormScreen
            const formKey = `checkin-guest-form-${reservationUuid}`
            const rawForm = localStorage.getItem(formKey)
            if (!rawForm) {
                throw new Error("No se encontraron los datos del formulario.")
            }
            const form: GuestFormData = JSON.parse(rawForm)

            const formAny = form as any
            const payload: CompleteMainGuestPayload = {
                guestUuid,
                profile: {
                    name: form.name,
                    lastname: form.lastname,
                    email: form.email,
                    phone: form.phone,
                    dateOfBirth: form.dateOfBirth,
                    genderId: form.genderId ? Number(form.genderId) : null,
                    nationalityId: Number(form.nationalityId),
                    cityOfResidence: form.cityOfResidence || undefined,
                    countryOfResidenceId: form.countryOfResidenceId ? Number(form.countryOfResidenceId) : undefined,
                    identificationExpiryDate: formAny.identificationExpiryDate || undefined,
                },
                extra: {
                    countryOfOriginId: form.countryOfOriginId ? Number(form.countryOfOriginId) : undefined,
                    countryDestinationId: form.countryDestinationId ? Number(form.countryDestinationId) : undefined,
                    cityOfOrigin: form.cityOfOrigin || undefined,
                    reasonForTripId: form.reasonForTripId ? Number(form.reasonForTripId) : undefined,
                    documentImage1: form.documentImage1,
                    documentImage2: form.documentImage2,
                },
                signature
            }

            // Call the real v4 endpoint — backend only returns { message }
            await checkinService.completeMainGuest(reservationUuid, payload)

            // Clean up form data and identify session to prevent stale data on re-entry
            localStorage.removeItem(formKey)
            localStorage.removeItem(`checkin-identify-${reservationUuid}`)
            // Flag main guest as done so WelcomeScreen unlocks secondaries on next visit
            localStorage.setItem(`checkin-main-done-${reservationUuid}`, 'true')

            // Re-fetch portal to get updated state (backend doesn't return it in complete response)
            const portal = await checkinService.getPortal(reservationUuid)

            if (portal.progress.isFullyCompleted) {
                toast.success("¡Check-in completado para todos los huéspedes!")
                router.push(`${basePath}/success?guest_uuid=${guestUuid}`)
            } else {
                const pending = portal.reservation.totalGuestsAllowed - portal.progress.completed
                toast.success("Tu registro está completo. Los acompañantes ya pueden iniciar su registro.")
                router.push(`${basePath}/success?guest_uuid=${guestUuid}&main_done=true&pending=${pending}`)
            }
        } catch (e: any) {
            if (e.status === 409) {
                // Already completed — redirect to success without error
                toast.success("Ya completaste tu check-in anteriormente.")
                router.push(`${basePath}/success?guest_uuid=${guestUuid}`)
            } else {
                toast.error(e.message || "Error al completar el check-in")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 size={40} className="text-brand-purple animate-spin" />
                <p className="text-sm text-slate-500 mt-4">Cargando contrato...</p>
            </div>
        )
    }

    // Replace variables in the template
    let finalHtml = template?.bodyHtml || ""
    if (template?.variables) {
        Object.entries(template.variables).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g')
            finalHtml = finalHtml.replace(regex, String(value))
        })
    }

    const isFormValid = signature !== null && accepted

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={4} totalSteps={5} />

            <div className="flex items-center justify-between">
                <Link href={`${basePath}/guest?guest_uuid=${guestUuid}`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Paso 5 de 6</div>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    Firma tu Contrato
                </h1>
                <p className="text-slate-500 text-sm">
                    Revisa los términos de tu estadía y firma para finalizar.
                </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <FileText size={20} className="text-brand-purple" />
                    <h2 className="font-bold text-slate-800">{template?.title || "Contrato"}</h2>
                </div>
                
                <div 
                    className="prose prose-sm prose-slate max-w-none max-h-60 overflow-y-auto pr-2 no-scrollbar"
                    dangerouslySetInnerHTML={{ __html: finalHtml }}
                />
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
                <SignaturePad onSignatureChange={setSignature} />

                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-purple/30 transition-colors">
                    <div className="relative flex items-center justify-center mt-0.5">
                        <input 
                            type="checkbox" 
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-2 focus:ring-brand-purple/20 checked:bg-brand-purple checked:border-brand-purple transition-all"
                        />
                        <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-slate-600 font-medium select-none">
                        He leído y acepto los términos del contrato de arrendamiento.
                    </span>
                </label>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <button
                        onClick={handleComplete}
                        disabled={!isFormValid || isSubmitting}
                        className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="animate-spin" size={20} /> Finalizando...</>
                        ) : (
                            "Firmar y Completar"
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
