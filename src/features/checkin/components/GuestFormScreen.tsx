"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, FileText, User, Globe, Plane, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { CatalogService } from "@/features/auth/services/catalog-service"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import {
    type GuestFormData,
    type GuestFormSchemaResponse
} from "@/features/checkin/types/checkin"
import { MAIN_GUEST_STEPS } from "@/features/checkin/data/constants"
import { useLocalStorage } from "@/features/checkin/hooks/useLocalStorage"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { FormInput } from "@/features/checkin/components/FormInput"
import { CollapsibleSection } from "@/features/checkin/components/CollapsibleSection"
import { StepIndicator } from "@/features/checkin/components/StepIndicator"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { DocumentUpload } from "@/features/checkin/components/DocumentUpload"
import {
    mockDocumentTypes,
    mockGenders,
} from "@/features/checkin/data/mock-guest-data"
import { emptyGuestForm } from "@/features/checkin/types/checkin"

interface GuestFormScreenProps {
    reservationUuid: string
    basePath: string
}

export function GuestFormScreen({ reservationUuid, basePath }: GuestFormScreenProps) {
    const { load } = useIdentifySession(reservationUuid)
    const session = load()

    const [form, setForm] = useLocalStorage<GuestFormData>(`checkin-guest-form-${reservationUuid}`, {
        ...emptyGuestForm,
        name: session?.guestName ?? "",
        lastname: session?.guestLastname ?? "",
        nationalityId: 48,
        documentCountryId: 48,
        identificationTypeId: 7,
    })

    const [schema, setSchema] = useState<GuestFormSchemaResponse | null>(null)
    const [isLoadingSchema, setIsLoadingSchema] = useState(true)
    const [docVerified, setDocVerified] = useState(false)
    const [countryOptions, setCountryOptions] = useState<Array<{ id: number; label: string }>>([])
    const [tripReasonOptions, setTripReasonOptions] = useState<Array<{ id: number; label: string }>>([])

    const [expanded, setExpanded] = useState({
        document: true,
        personal: true,
        origin: true,
        travel: true,
        photos: true,
    })

    const router = useRouter()
    const searchParams = useSearchParams()
    const guestUuid = searchParams.get("guest_uuid") || ""

    useEffect(() => {
        if (!guestUuid) {
            router.push(`${basePath}/identify`)
            return
        }
        try {
            const key = `checkin-verification-done-${reservationUuid}-${guestUuid}`
            setDocVerified(localStorage.getItem(key) === 'true')
        } catch {}

        const fetchSchema = async () => {
            try {
                const [resSchema, countries, reasons] = await Promise.all([
                    checkinService.getGuestFormSchema(reservationUuid, guestUuid),
                    new CatalogService().getCountries(),
                    new CatalogService().getReasonsForTrip(),
                ])
                setSchema(resSchema)
                setCountryOptions((countries || []).map((c: any) => ({ id: c.id, label: c.name })))
                setTripReasonOptions((reasons || []).map((r: any) => ({ id: r.id, label: r.nameTranslations?.es || r.name })))
                
                // Merge prefilledData ONLY if the field is currently empty in our form state
                // This prevents overwriting user edits or OCR data from VerifyScreen
                if (resSchema.prefilledData) {
                    setForm(prev => {
                        const updated = { ...prev } as any
                        Object.entries(resSchema.prefilledData).forEach(([k, v]) => {
                            if (!updated[k] && v !== undefined && v !== null) {
                                updated[k] = v
                            }
                        })
                        return updated as GuestFormData
                    })
                }
            } catch (e) {
                toast.error("Error al cargar configuración del formulario")
            } finally {
                setIsLoadingSchema(false)
            }
        }
        
        fetchSchema()
    }, [reservationUuid, guestUuid, basePath, router, setForm])

    const toggleSection = (key: keyof typeof expanded) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const updateField = <K extends keyof GuestFormData>(field: K, value: GuestFormData[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const isPassport = form.identificationTypeId === 9

    const isFieldVisible = (key: string) => 
        schema?.requiredFields.includes(key) || schema?.optionalFields.includes(key)
    
    const isFieldRequired = (key: string) => 
        schema?.requiredFields.includes(key)

    const showOriginSection = 
        isFieldVisible('countryOfOriginId') || 
        isFieldVisible('reasonForTripId') || 
        isFieldVisible('countryDestinationId') || 
        isFieldVisible('nationalityId')

    // phone and email are NOT hardcoded — they're only required when schema says so
    const baseValid =
        form.documentCountryId !== "" &&
        form.identificationTypeId !== "" &&
        form.identificationNumber.trim() !== "" &&
        form.name.trim() !== "" &&
        form.lastname.trim() !== "" &&
        form.dateOfBirth !== "" &&
        form.documentImage1 !== null &&
        (isPassport || form.documentImage2 !== null)

    const dynamicValid = schema?.requiredFields.every(key => {
        const val = form[key as keyof GuestFormData]
        return val !== null && val !== "" && val !== undefined
    }) ?? false

    const isFormValid = baseValid && dynamicValid

    // Catalogs loaded separately via CatalogService (not included in formSchema response)
    const docTypeOptions = mockDocumentTypes.map((d) => ({ id: d.id, label: d.nameTranslations.es }))
    const genderOptions = mockGenders.map((g) => ({ id: g.id, label: g.nameTranslations.es }))

    const nextPath = `${basePath}/contract?guest_uuid=${guestUuid}`

    const handleSubmit = () => {
        // En FASE 5: NO llamamos a completeMainGuest aquí.
        // Solo hemos guardado el estado en localStorage (vía useLocalStorage).
        // Navegamos al contrato, donde se unirá la firma y se hará el submit final.
        router.push(nextPath)
    }

    if (isLoadingSchema) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
                <p className="text-sm font-medium text-slate-500">Preparando formulario...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={3} totalSteps={5} />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href={`${basePath}/verify?guest_uuid=${guestUuid}`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        Paso 4 de 6
                    </div>
                </div>
                <div className="text-xs font-semibold px-2 py-1 bg-brand-purple/10 text-brand-purple rounded-lg">
                    Huésped Titular
                </div>
            </div>

            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Datos del Titular</h1>
                <p className="text-slate-500 text-sm">
                    Requerido por regulaciones locales de alojamiento. Los campos con <span className="text-red-400">*</span> son obligatorios.
                </p>
            </div>

            {/* ── Document Section ── */}
            <CollapsibleSection icon={<FileText size={18} />} title="Documento de identidad" expanded={expanded.document} onToggle={() => toggleSection("document")} badge={form.identificationNumber ? "✓" : undefined}>
                <div className="space-y-4">
                    {docVerified && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2">
                            <CheckCircle2 size={16} className="text-green-600" />
                            <span className="text-xs font-semibold">Documento ya verificado</span>
                        </div>
                    )}
                    <SearchableSelect label="País del documento" options={countryOptions} value={form.documentCountryId} onChange={(v) => updateField("documentCountryId", v)} placeholder="Seleccionar país..." required />
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-1.5">
                            <SearchableSelect label="Tipo Doc." options={docTypeOptions} value={form.identificationTypeId} onChange={(v) => updateField("identificationTypeId", v)} placeholder="Selec." required />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Número de Documento<span className="text-red-400 ml-0.5">*</span></label>
                            <input type="text" value={form.identificationNumber ?? ""} onChange={(e) => updateField("identificationNumber", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" placeholder="Ej. 1234567890" />
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ── Personal Section ── */}
            <CollapsibleSection icon={<User size={18} />} title="Datos personales" expanded={expanded.personal} onToggle={() => toggleSection("personal")} badge={form.name && form.lastname ? "✓" : undefined}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Nombre" value={form.name} onChange={(v) => updateField("name", v)} placeholder="Ej. Ricardo" required />
                        <FormInput label="Apellidos" value={form.lastname} onChange={(v) => updateField("lastname", v)} placeholder="Ej. Lombana" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Fecha de nacimiento<span className="text-red-400 ml-0.5">*</span></label>
                            <input type="date" value={form.dateOfBirth ?? ""} onChange={(e) => updateField("dateOfBirth", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <SearchableSelect label="Género" options={genderOptions} value={form.genderId} onChange={(v) => updateField("genderId", v)} placeholder="Seleccionar" />
                        </div>
                    </div>
                    <FormInput label="Teléfono / WhatsApp" value={form.phone} onChange={(v) => updateField("phone", v)} placeholder="+57 300 123 4567" type="tel" required />
                    <FormInput label="Email" value={form.email} onChange={(v) => updateField("email", v)} placeholder="correo@ejemplo.com" type="email" required />
                </div>
            </CollapsibleSection>

            {/* ── Origin/Destination Section ── */}
            {showOriginSection && (
                <CollapsibleSection icon={<Globe size={18} />} title="Origen y destino" expanded={expanded.origin} onToggle={() => toggleSection("origin")} badge={form.nationalityId && form.countryOfOriginId && form.countryDestinationId && form.reasonForTripId ? "✓" : undefined}>
                    <div className="space-y-4">
                        {isFieldVisible('nationalityId') && (
                            <SearchableSelect label="Nacionalidad" options={countryOptions} value={form.nationalityId} onChange={(v) => updateField("nationalityId", v)} placeholder="Seleccionar país..." required={isFieldRequired('nationalityId')} />
                        )}
                        
                        {(isFieldVisible('countryOfResidenceId') || isFieldVisible('cityOfResidence')) && (
                            <div className="grid grid-cols-2 gap-3">
                                {isFieldVisible('countryOfResidenceId') && (
                                    <SearchableSelect label="País de residencia" options={countryOptions} value={form.countryOfResidenceId} onChange={(v) => updateField("countryOfResidenceId", v)} placeholder="Seleccionar..." required={isFieldRequired('countryOfResidenceId')} />
                                )}
                                {isFieldVisible('cityOfResidence') && (
                                    <FormInput label="Ciudad de residencia" value={form.cityOfResidence} onChange={(v) => updateField("cityOfResidence", v)} placeholder="Ej. Bogotá" required={isFieldRequired('cityOfResidence')} />
                                )}
                            </div>
                        )}

                        {isFieldVisible('countryOfOriginId') && (
                            <SearchableSelect label="País de origen (de dónde viene)" options={countryOptions} value={form.countryOfOriginId} onChange={(v) => updateField("countryOfOriginId", v)} placeholder="Seleccionar país..." required={isFieldRequired('countryOfOriginId')} />
                        )}

                        {isFieldVisible('cityOfOrigin') && (
                            <FormInput label="Ciudad de origen" value={form.cityOfOrigin} onChange={(v) => updateField("cityOfOrigin", v)} placeholder="Ej. Bogotá" required={isFieldRequired('cityOfOrigin')} />
                        )}

                        {(isFieldVisible('countryDestinationId') || isFieldVisible('cityDestination')) && (
                            <div className="grid grid-cols-2 gap-3">
                                {isFieldVisible('countryDestinationId') && (
                                    <SearchableSelect label="País destino" options={countryOptions} value={form.countryDestinationId} onChange={(v) => updateField("countryDestinationId", v)} placeholder="Seleccionar..." required={isFieldRequired('countryDestinationId')} />
                                )}
                                {isFieldVisible('cityDestination') && (
                                    <FormInput label="Ciudad destino" value={form.cityDestination} onChange={(v) => updateField("cityDestination", v)} placeholder="Ej. Cali" required={isFieldRequired('cityDestination')} />
                                )}
                            </div>
                        )}

                        {isFieldVisible('reasonForTripId') && (
                            <div className="space-y-1.5">
                                <SearchableSelect label="Razón del viaje" options={tripReasonOptions} value={form.reasonForTripId} onChange={(v) => updateField("reasonForTripId", v)} placeholder="Seleccionar motivo..." required={isFieldRequired('reasonForTripId')} />
                            </div>
                        )}
                    </div>
                </CollapsibleSection>
            )}

            {/* ── Travel Section (optional) ── */}
            {(isFieldVisible('arrivalTime') || isFieldVisible('departureTime') || isFieldVisible('arrivalFlight') || isFieldVisible('departureFlight')) && (
                <CollapsibleSection icon={<Plane size={18} />} title="Información de viaje" expanded={expanded.travel} onToggle={() => toggleSection("travel")} optional>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {isFieldVisible('arrivalTime') && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Hora de llegada{isFieldRequired('arrivalTime') && <span className="text-red-400 ml-0.5">*</span>}</label>
                                    <input type="time" value={form.arrivalTime ?? ""} onChange={(e) => updateField("arrivalTime", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                                </div>
                            )}
                            {isFieldVisible('departureTime') && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Hora de salida{isFieldRequired('departureTime') && <span className="text-red-400 ml-0.5">*</span>}</label>
                                    <input type="time" value={form.departureTime ?? ""} onChange={(e) => updateField("departureTime", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {isFieldVisible('arrivalFlight') && (
                                <FormInput label="# Vuelo llegada" value={form.arrivalFlight} onChange={(v) => updateField("arrivalFlight", v)} placeholder="Ej. AV123" required={isFieldRequired('arrivalFlight')} />
                            )}
                            {isFieldVisible('departureFlight') && (
                                <FormInput label="# Vuelo salida" value={form.departureFlight} onChange={(v) => updateField("departureFlight", v)} placeholder="Ej. AV456" required={isFieldRequired('departureFlight')} />
                            )}
                        </div>
                    </div>
                </CollapsibleSection>
            )}

            {/* ── Photos Section ── */}
            <CollapsibleSection icon={<FileText size={18} />} title="Fotos del documento" expanded={expanded.photos} onToggle={() => toggleSection("photos")} badge={form.documentImage1 ? "✓" : undefined}>
                <div className="space-y-4">
                    <DocumentUpload label="Foto del documento (frente)" value={form.documentImage1} onChange={(v) => updateField("documentImage1", v)} required id="doc-front" />
                    {!isPassport && (
                        <DocumentUpload label="Foto del documento (reverso)" value={form.documentImage2} onChange={(v) => updateField("documentImage2", v)} required id="doc-back" />
                    )}
                    {isPassport && (
                        <p className="text-xs text-slate-400 text-center mt-1">Para pasaporte solo se requiere la página de datos.</p>
                    )}
                </div>
            </CollapsibleSection>

            {/* CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    {isFormValid ? (
                        <button 
                            onClick={handleSubmit} 
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98]"
                        >
                            <CheckCircle2 size={20} />
                            Continuar
                        </button>
                    ) : (
                        <button disabled className="w-full flex items-center justify-center h-14 bg-slate-100 text-slate-400 rounded-xl font-bold text-lg cursor-not-allowed">
                            Completa los campos requeridos
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
