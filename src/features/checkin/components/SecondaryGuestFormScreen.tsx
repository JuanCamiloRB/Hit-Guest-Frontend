"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { CatalogService, type IdentificationTypeOption } from "@/features/auth/services/catalog-service"
import { 
    GuestFormData,
    GuestFormSchemaResponse,
    CompleteSecondaryGuestPayload
} from "@/features/checkin/types/checkin"
import { SECONDARY_GUEST_STEPS } from "@/features/checkin/data/constants"
import { useLocalStorage } from "@/features/checkin/hooks/useLocalStorage"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { FormInput } from "@/features/checkin/components/FormInput"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import { DynamicCheckinFields, areDynamicFieldsValid, getProviderUserFields } from "@/features/checkin/components/DynamicCheckinFields"
import { CollapsibleSection } from "@/features/checkin/components/CollapsibleSection"
import { mockDocumentTypes, mockGenders } from "@/features/checkin/data/mock-guest-data"
import { DocumentUpload } from "@/features/checkin/components/DocumentUpload"
import { ArrowLeft, User, FileText, Globe, Plane, Loader2, CheckCircle2, ClipboardList } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SecondaryGuestFormScreenProps {
    reservationUuid: string
    guestToken: string
    basePath: string
}

export function SecondaryGuestFormScreen({ reservationUuid, guestToken, basePath }: SecondaryGuestFormScreenProps) {
    const router = useRouter()
    const { load } = useIdentifySession(reservationUuid)
    const session = load()
    const guestUuid = session?.guestUuid

    const [form, setForm] = useLocalStorage<Partial<GuestFormData>>(`checkin-secondary-form-${guestToken}`, {
        name: session?.guestName ?? "",
        lastname: session?.guestLastname ?? "",
        documentCountryId: 48,
        identificationTypeId: 7,
    }, { excludeKeys: ["documentImage1", "documentImage2"] })

    const [schema, setSchema] = useState<GuestFormSchemaResponse | null>(null)
    const [isLoadingSchema, setIsLoadingSchema] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [docVerified, setDocVerified] = useState(false)
    const [countryOptions, setCountryOptions] = useState<Array<{ id: number; label: string }>>([])
    const [countriesRaw, setCountriesRaw] = useState<any[]>([])
    const [tripReasonOptions, setTripReasonOptions] = useState<Array<{ id: number; label: string }>>([])
    const [identTypes, setIdentTypes] = useState<IdentificationTypeOption[]>([])

    const [expanded, setExpanded] = useState({
        document: true,
        personal: true,
        origin: true,
        travel: true,
        photos: true,
        additional: true,
    })

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
                const savedSchema = session?.formSchema as unknown as GuestFormSchemaResponse | undefined
                // Identification types are loaded separately, per the document country (ISO2).
                const [countries, reasons] = await Promise.all([
                    new CatalogService().getCountries(),
                    new CatalogService().getReasonsForTrip(),
                ])
                setCountriesRaw(countries || [])
                setCountryOptions((countries || []).map((c: any) => ({ id: c.id, label: c.name })))
                setTripReasonOptions((reasons || []).map((r: any) => ({ id: r.id, label: r.nameTranslations?.es || r.name })))

                // /form is the authoritative post-verification source: rich prefilledData
                // (name, lastname, dateOfBirth, document, …) + provider userFields. Merge it
                // over the identify-session schema (/form wins), fall back to session on error.
                let resSchema: GuestFormSchemaResponse | null = savedSchema ?? null
                if (guestUuid) {
                    try {
                        const formSchema = await checkinService.getGuestFormSchema(reservationUuid, guestUuid)
                        if (formSchema) {
                            resSchema = resSchema
                                ? {
                                    ...resSchema,
                                    userFields: formSchema.userFields ?? resSchema.userFields,
                                    prefilledData: { ...(resSchema.prefilledData ?? {}), ...(formSchema.prefilledData ?? {}) },
                                }
                                : formSchema
                        }
                    } catch {
                        console.warn("[SecondaryGuestFormScreen] /form endpoint unavailable; using identify session schema")
                    }
                }
                setSchema(resSchema)

                const prefilledData = resSchema?.prefilledData
                if (prefilledData) {
                    // Also check for OCR data saved by VerifyScreen's handleOcrConfirm
                    let ocrOverrides: Record<string, any> = {}
                    try {
                        const ocrKey = `checkin-ocr-data-${reservationUuid}-${guestUuid}`
                        const raw = guestUuid ? localStorage.getItem(ocrKey) : null
                        if (raw) {
                            const ocr = JSON.parse(raw)
                            if (ocr.firstName) ocrOverrides.name = ocr.firstName
                            if (ocr.lastName) ocrOverrides.lastname = ocr.lastName
                            if (ocr.documentNumber) ocrOverrides.identificationNumber = ocr.documentNumber
                            if (ocr.dateOfBirth) ocrOverrides.dateOfBirth = ocr.dateOfBirth
                            if (ocr.expirationDate) ocrOverrides.identificationExpiryDate = ocr.expirationDate
                        }
                    } catch {}

                    const NUMERIC_ID_FIELDS = new Set(["identificationTypeId", "nationalityId", "documentCountryId", "genderId", "countryOfOriginId", "countryDestinationId", "reasonForTripId"])
                    const STRING_FIELDS = new Set(["name", "lastname", "identificationNumber", "phone", "email", "dateOfBirth", "identificationExpiryDate"])
                    const HARDCODED_DEFAULTS: Record<string, unknown> = {
                        identificationTypeId: 7,
                        nationalityId: 48,
                        documentCountryId: 48,
                        name: session?.guestName ?? "",
                        lastname: session?.guestLastname ?? "",
                    }
                    const coerce = (k: string, v: unknown): unknown => {
                        if (NUMERIC_ID_FIELDS.has(k)) return Number(v)
                        if (STRING_FIELDS.has(k)) return String(v ?? "")
                        return v
                    }

                    setForm(prev => {
                        const updated = { ...prev } as any
                        // prefilledData from backend: apply when field is empty OR still at its hardcoded default
                        Object.entries(prefilledData).forEach(([k, v]) => {
                            if (v !== undefined && v !== null && v !== "") {
                                const isEmpty = updated[k] === "" || updated[k] === null || updated[k] === undefined
                                const isAtDefault = k in HARDCODED_DEFAULTS && updated[k] == HARDCODED_DEFAULTS[k]
                                if (isEmpty || isAtDefault) {
                                    updated[k] = coerce(k, v)
                                }
                            }
                        })
                        // OCR data always wins — it's fresher and user-confirmed
                        Object.entries(ocrOverrides).forEach(([k, v]) => {
                            if (v !== undefined && v !== null && v !== "") updated[k] = v
                        })
                        return updated
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

    // Identification types are country-specific: load them per the selected document
    // country (ISO2), e.g. /catalogs/identification-types?country=CO. Reloads on change.
    const documentCountryIso2 = countriesRaw.find(
        (c) => Number(c.id) === Number(form.documentCountryId)
    )?.extra?.iso2 as string | undefined
    useEffect(() => {
        if (!documentCountryIso2) return
        let active = true
        new CatalogService().getIdentificationTypesV2(documentCountryIso2)
            .then((types) => { if (active) setIdentTypes(types || []) })
            .catch(() => {})
        return () => { active = false }
    }, [documentCountryIso2])

    const updateField = (field: keyof GuestFormData, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    // Provider-declared dynamic fields (v4.6) — exclude any that overlap the core form.
    const dynamicFields = getProviderUserFields(schema?.userFields)
    const dynamicValues = form.dynamicExtra ?? {}
    const updateDynamicField = (key: string, value: string | number) => {
        setForm(prev => ({ ...prev, dynamicExtra: { ...(prev.dynamicExtra ?? {}), [key]: value } }))
    }

    const toggleSection = (section: keyof typeof expanded) => {
        setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
    }

    // Whether the selected document needs a back image. Prefer the authoritative
    // `requiresBackImage` from the catalog; fall back to a name heuristic if the
    // country-aware list hasn't loaded.
    const selectedType = identTypes.find(t => t.id === form.identificationTypeId)
    const selectedDocName = selectedType?.name
        ?? mockDocumentTypes.find(d => d.id === form.identificationTypeId)?.name
        ?? ""
    const isSingleSidedDoc = selectedType
        ? !selectedType.requiresBackImage
        : /pasaporte|passport|licencia|licen[cs]e|nit/i.test(selectedDocName)

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
        String(form.identificationNumber ?? "").trim() !== "" &&
        String(form.name ?? "").trim() !== "" &&
        String(form.lastname ?? "").trim() !== "" &&
        form.dateOfBirth !== "" &&
        (docVerified || form.documentImage1 !== null) &&
        (docVerified || isSingleSidedDoc || form.documentImage2 !== null)

    // A missing schema must not permanently disable the button — the backend
    // validates required fields on submit (and surfaces them via notifyError).
    const dynamicValid = schema?.requiredFields.every(key => {
        const val = form[key as keyof GuestFormData]
        return val !== null && val !== "" && val !== undefined
    }) ?? true

    const userFieldsValid = areDynamicFieldsValid(dynamicFields, dynamicValues)

    const isFormValid = baseValid && dynamicValid && userFieldsValid

    // Catalogs loaded separately via CatalogService (not included in formSchema response)
    const docTypeOptions = identTypes.length > 0
        ? identTypes.map((d) => ({ id: d.id, label: d.name }))
        : mockDocumentTypes.map((d) => ({ id: d.id, label: d.nameTranslations.es }))
    const genderOptions = mockGenders.map((g) => ({ id: g.id, label: g.nameTranslations.es }))

    const nextPath = `${basePath}/success`

    const handleSubmit = async () => {
        if (!guestUuid) return
        setIsSubmitting(true)
        try {
            const formAny = form as any
            const payload: CompleteSecondaryGuestPayload = {
                profile: {
                    name: form.name as string,
                    lastname: form.lastname as string,
                    email: form.email,
                    phone: form.phone,
                    dateOfBirth: form.dateOfBirth as string,
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
                    documentImage1: form.documentImage1 || null,
                    documentImage2: form.documentImage2 || null,
                    arrivalTime: form.arrivalTime,
                    departureTime: form.departureTime,
                    arrivalFlight: form.arrivalFlight,
                    departureFlight: form.departureFlight,
                    // Provider-declared dynamic fields (v4.6) — sent verbatim under their keys.
                    ...(form.dynamicExtra ?? {}),
                }
            }

            // Backend only returns { message } — re-fetch portal for updated state
            await checkinService.completeSecondaryGuest(reservationUuid, guestUuid, payload)
            
            // Clean up form data and mark this secondary guest as done
            localStorage.removeItem(`checkin-secondary-form-${guestToken}`)
            localStorage.setItem(`checkin-secondary-done-${reservationUuid}-${guestToken}`, 'true')

            // Re-fetch portal to check if all guests are done
            const portal = await checkinService.getPortal(reservationUuid)

            if (portal.progress.isFullyCompleted) {
                toast.success("¡Check-in completado para todos los huéspedes!")
            } else {
                toast.success("Tus datos fueron registrados correctamente")
            }
            router.push(nextPath)
        } catch (error: any) {
            if (error.status === 403) {
                toast.error("El huésped principal debe completar su registro primero")
                router.push(basePath)
            } else {
                notifyError(error, "Error al completar el check-in")
            }
        } finally {
            setIsSubmitting(false)
        }
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
            <ProgressBar currentStep={3} totalSteps={3} />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Back to the welcome hub, not /verify (avoids re-launching verification). */}
                    <Link href={basePath} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        Paso 3 de 4
                    </div>
                </div>
                <div className="text-xs font-semibold px-2 py-1 bg-brand-navy/10 text-brand-navy rounded-lg">
                    Huésped Adicional
                </div>
            </div>

            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Completa tus datos</h1>
                <p className="text-slate-500 text-sm">
                    Requerido por regulaciones locales de alojamiento. Los campos con <span className="text-red-400">*</span> son obligatorios.
                </p>
            </div>

            {/* ── Document Section ── */}
            <CollapsibleSection icon={<FileText size={18} />} title="Documento de identidad" expanded={expanded.document} onToggle={() => toggleSection("document")} badge={form.identificationNumber ? "✓" : undefined}>
                <div className="space-y-4">
                    <SearchableSelect label="País del documento" options={countryOptions} value={form.documentCountryId as any} onChange={(v) => updateField("documentCountryId", v)} placeholder="Seleccionar país..." required />
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 space-y-1.5">
                            <SearchableSelect label="Tipo Doc." options={docTypeOptions} value={form.identificationTypeId as any} onChange={(v) => updateField("identificationTypeId", v)} placeholder="Selec." required />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Número de Documento<span className="text-red-400 ml-0.5">*</span></label>
                            <input type="text" value={form.identificationNumber || ""} onChange={(e) => updateField("identificationNumber", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" placeholder="Ej. 1234567890" />
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ── Personal Section ── */}
            <CollapsibleSection icon={<User size={18} />} title="Datos personales" expanded={expanded.personal} onToggle={() => toggleSection("personal")} badge={form.name && form.lastname ? "✓" : undefined}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Nombre" value={form.name || ""} onChange={(v) => updateField("name", v)} placeholder="Ej. Ricardo" required />
                        <FormInput label="Apellidos" value={form.lastname || ""} onChange={(v) => updateField("lastname", v)} placeholder="Ej. Lombana" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Fecha de nacimiento<span className="text-red-400 ml-0.5">*</span></label>
                            <input type="date" value={form.dateOfBirth || ""} onChange={(e) => updateField("dateOfBirth", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <SearchableSelect label="Género" options={genderOptions} value={form.genderId as any} onChange={(v) => updateField("genderId", v)} placeholder="Seleccionar" />
                        </div>
                    </div>
                    {isFieldVisible('phone') && (
                        <FormInput label="Teléfono / WhatsApp" value={form.phone || ""} onChange={(v) => updateField("phone", v)} placeholder="+57 300 123 4567" type="tel" required={isFieldRequired('phone')} />
                    )}
                    {isFieldVisible('email') && (
                        <FormInput label="Email" value={form.email || ""} onChange={(v) => updateField("email", v)} placeholder="correo@ejemplo.com" type="email" required={isFieldRequired('email')} />
                    )}
                </div>
            </CollapsibleSection>

            {/* ── Origin/Destination Section ── */}
            {showOriginSection && (
                <CollapsibleSection icon={<Globe size={18} />} title="Origen y destino" expanded={expanded.origin} onToggle={() => toggleSection("origin")} badge={form.nationalityId && form.countryOfOriginId && form.countryDestinationId ? "✓" : undefined}>
                    <div className="space-y-4">
                        {isFieldVisible('nationalityId') && (
                            <SearchableSelect label="Nacionalidad" options={countryOptions} value={form.nationalityId as any} onChange={(v) => updateField("nationalityId", v)} placeholder="Seleccionar país..." required={isFieldRequired('nationalityId')} />
                        )}
                        
                        {(isFieldVisible('countryOfResidenceId') || isFieldVisible('cityOfResidence')) && (
                            <div className="grid grid-cols-2 gap-3">
                                {isFieldVisible('countryOfResidenceId') && (
                                    <SearchableSelect label="País de residencia" options={countryOptions} value={form.countryOfResidenceId as any} onChange={(v) => updateField("countryOfResidenceId", v)} placeholder="Seleccionar..." required={isFieldRequired('countryOfResidenceId')} />
                                )}
                                {isFieldVisible('cityOfResidence') && (
                                    <FormInput label="Ciudad de residencia" value={form.cityOfResidence || ""} onChange={(v) => updateField("cityOfResidence", v)} placeholder="Ej. Bogotá" required={isFieldRequired('cityOfResidence')} />
                                )}
                            </div>
                        )}

                        {isFieldVisible('countryOfOriginId') && (
                            <SearchableSelect label="País de origen (de dónde viene)" options={countryOptions} value={form.countryOfOriginId as any} onChange={(v) => updateField("countryOfOriginId", v)} placeholder="Seleccionar país..." required={isFieldRequired('countryOfOriginId')} />
                        )}

                        {isFieldVisible('cityOfOrigin') && (
                            <FormInput label="Ciudad de origen" value={form.cityOfOrigin || ""} onChange={(v) => updateField("cityOfOrigin", v)} placeholder="Ej. Bogotá" required={isFieldRequired('cityOfOrigin')} />
                        )}

                        {(isFieldVisible('countryDestinationId') || isFieldVisible('cityDestination')) && (
                            <div className="grid grid-cols-2 gap-3">
                                {isFieldVisible('countryDestinationId') && (
                                    <SearchableSelect label="País destino" options={countryOptions} value={form.countryDestinationId as any} onChange={(v) => updateField("countryDestinationId", v)} placeholder="Seleccionar..." required={isFieldRequired('countryDestinationId')} />
                                )}
                                {isFieldVisible('cityDestination') && (
                                    <FormInput label="Ciudad destino" value={form.cityDestination || ""} onChange={(v) => updateField("cityDestination", v)} placeholder="Ej. Cali" required={isFieldRequired('cityDestination')} />
                                )}
                            </div>
                        )}

                        {isFieldVisible('reasonForTripId') && (
                            <div className="space-y-1.5">
                                <SearchableSelect label="Razón del viaje" options={tripReasonOptions} value={form.reasonForTripId as any} onChange={(v) => updateField("reasonForTripId", v)} placeholder="Seleccionar motivo..." required={isFieldRequired('reasonForTripId')} />
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
                                    <input type="time" value={form.arrivalTime || ""} onChange={(e) => updateField("arrivalTime", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                                </div>
                            )}
                            {isFieldVisible('departureTime') && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Hora de salida{isFieldRequired('departureTime') && <span className="text-red-400 ml-0.5">*</span>}</label>
                                    <input type="time" value={form.departureTime || ""} onChange={(e) => updateField("departureTime", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {isFieldVisible('arrivalFlight') && (
                                <FormInput label="# Vuelo llegada" value={form.arrivalFlight || ""} onChange={(v) => updateField("arrivalFlight", v)} placeholder="Ej. AV123" required={isFieldRequired('arrivalFlight')} />
                            )}
                            {isFieldVisible('departureFlight') && (
                                <FormInput label="# Vuelo salida" value={form.departureFlight || ""} onChange={(v) => updateField("departureFlight", v)} placeholder="Ej. AV456" required={isFieldRequired('departureFlight')} />
                            )}
                        </div>
                    </div>
                </CollapsibleSection>
            )}

            {/* ── Provider-declared dynamic fields (v4.6) ── */}
            {dynamicFields.length > 0 && (
                <CollapsibleSection icon={<ClipboardList size={18} />} title="Información requerida" expanded={expanded.additional} onToggle={() => toggleSection("additional")}>
                    <DynamicCheckinFields fields={dynamicFields} values={dynamicValues} onChange={updateDynamicField} />
                </CollapsibleSection>
            )}

            {/* ── Photos Section (skip if biometric/Didit already verified documents) ── */}
            {!docVerified && (
                <CollapsibleSection icon={<FileText size={18} />} title="Fotos del documento" expanded={expanded.photos} onToggle={() => toggleSection("photos")} badge={form.documentImage1 ? "✓" : undefined}>
                    <div className="space-y-4">
                        <DocumentUpload label="Foto del documento (frente)" value={form.documentImage1 || null} onChange={(v) => updateField("documentImage1", v)} required id="doc-front" />
                        {!isSingleSidedDoc && (
                            <DocumentUpload label="Foto del documento (reverso)" value={form.documentImage2 || null} onChange={(v) => updateField("documentImage2", v)} required id="doc-back" />
                        )}
                        {isSingleSidedDoc && (
                            <p className="text-xs text-slate-400 text-center mt-1">Este documento solo requiere la imagen frontal.</p>
                        )}
                    </div>
                </CollapsibleSection>
            )}

            {/* ── Sticky Bottom Bar ── */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
                <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
                    <Button
                        onClick={handleSubmit}
                        disabled={!isFormValid || isSubmitting}
                        className="flex-1 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/25 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="animate-spin mr-2" size={20} /> Guardando...</>
                        ) : (
                            <><CheckCircle2 className="mr-2" size={20} /> Continuar</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
