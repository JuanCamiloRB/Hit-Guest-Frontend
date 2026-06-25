"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, FileText, User, Globe, Plane, Loader2, ClipboardList } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { CatalogService, type IdentificationTypeOption } from "@/features/auth/services/catalog-service"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import {
    type GuestFormData,
    type GuestFormSchemaResponse
} from "@/features/checkin/types/checkin"
import { MAIN_GUEST_STEPS } from "@/features/checkin/data/constants"
import { useLocalStorage } from "@/features/checkin/hooks/useLocalStorage"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { FormInput } from "@/features/checkin/components/FormInput"
import { DynamicCheckinFields, areDynamicFieldsValid, getProviderUserFields } from "@/features/checkin/components/DynamicCheckinFields"
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
    const searchParams = useSearchParams()
    const guestUuid = searchParams.get("guest_uuid") || ""
    const { load } = useIdentifySession(reservationUuid)
    const session = load(guestUuid || undefined)

    const [form, setForm] = useLocalStorage<GuestFormData>(`checkin-guest-form-${reservationUuid}`, {
        ...emptyGuestForm,
        name: session?.guestName ?? "",
        lastname: session?.guestLastname ?? "",
        nationalityId: 48,
        documentCountryId: 48,
        identificationTypeId: 7,
    }, { excludeKeys: ["documentImage1", "documentImage2"] })

    const [schema, setSchema] = useState<GuestFormSchemaResponse | null>(null)
    const [isLoadingSchema, setIsLoadingSchema] = useState(true)
    const [docVerified, setDocVerified] = useState(false)
    const [countryOptions, setCountryOptions] = useState<Array<{ id: number; label: string }>>([])
    // Raw countries kept so we can resolve a country id → ISO2 for the identification-types query.
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

    const router = useRouter()

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
                const catalogs = new CatalogService()

                // Load catalogs independently — these must never fail because the schema fetch failed.
                // Identification types are loaded separately, per the document country (ISO2).
                const [countries, reasons] = await Promise.all([
                    catalogs.getCountries(),
                    catalogs.getReasonsForTrip(),
                ])
                setCountriesRaw(countries || [])
                setCountryOptions((countries || []).map((c: any) => ({ id: c.id, label: c.name })))
                setTripReasonOptions((reasons || []).map((r: any) => ({ id: r.id, label: r.nameTranslations?.es || r.name })))

                // Base schema from the identify session (has prefilledData + legacy
                // required/optional fields). The provider-declared dynamic fields (v4.6)
                // come from the /form endpoint, which the identify session does NOT carry —
                // so always fetch /form and merge its userFields in. Falls back to the
                // session schema if /form is unavailable.
                let resSchema: GuestFormSchemaResponse | null = session?.formSchema as unknown as GuestFormSchemaResponse ?? null
                // /form is the authoritative post-verification source: it carries the rich
                // prefilledData (name, lastname, dateOfBirth, document, …) and the provider
                // userFields. Merge it over the identify-session schema (/form wins), falling
                // back to the session if /form is unavailable.
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
                    console.warn("[GuestFormScreen] /form endpoint unavailable; using identify session schema")
                }

                if (resSchema) {
                    setSchema(resSchema)
                    if (resSchema.prefilledData) {
                        // Also check for OCR data saved by VerifyScreen's handleOcrConfirm
                        let ocrOverrides: Record<string, any> = {}
                        try {
                            const ocrKey = `checkin-ocr-data-${reservationUuid}-${guestUuid}`
                            const raw = localStorage.getItem(ocrKey)
                            if (raw) {
                                const ocr = JSON.parse(raw)
                                // Map OCR fields → form fields
                                if (ocr.firstName) ocrOverrides.name = ocr.firstName
                                if (ocr.lastName) ocrOverrides.lastname = ocr.lastName
                                if (ocr.documentNumber) ocrOverrides.identificationNumber = ocr.documentNumber
                                if (ocr.dateOfBirth) ocrOverrides.dateOfBirth = ocr.dateOfBirth
                                if (ocr.expirationDate) ocrOverrides.identificationExpiryDate = ocr.expirationDate
                            }
                        } catch {}

                        // Fields that hold numeric IDs (should be stored as numbers)
                        const NUMERIC_ID_FIELDS = new Set(["identificationTypeId", "nationalityId", "documentCountryId", "genderId", "countryOfOriginId", "countryDestinationId", "reasonForTripId"])
                        // Fields that must always be strings
                        const STRING_FIELDS = new Set(["name", "lastname", "identificationNumber", "phone", "email", "dateOfBirth", "identificationExpiryDate"])

                        // Hardcoded defaults that should be overridden by real backend data
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
                            Object.entries(resSchema.prefilledData).forEach(([k, v]) => {
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
                            return updated as GuestFormData
                        })
                    }
                }
            } catch (e) {
                toast.error("Error al cargar catálogos")
            } finally {
                setIsLoadingSchema(false)
            }
        }
        
        fetchSchema()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservationUuid, guestUuid, basePath])

    // Identification types are country-specific: load them per the selected document
    // country (ISO2), e.g. /catalogs/identification-types?country=CO. Reloads when the
    // guest changes "País del documento".
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

    const toggleSection = (key: keyof typeof expanded) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const updateField = <K extends keyof GuestFormData>(field: K, value: GuestFormData[K]) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    // Provider-declared dynamic fields (v4.6) — exclude any that overlap the core form.
    const dynamicFields = getProviderUserFields(schema?.userFields)
    const dynamicValues = form.dynamicExtra ?? {}
    const updateDynamicField = (key: string, value: string | number) => {
        setForm((prev) => ({ ...prev, dynamicExtra: { ...(prev.dynamicExtra ?? {}), [key]: value } }))
    }

    // Whether the selected document needs a back image — prefer the catalog's
    // `requiresBackImage`, fall back to a name heuristic until the list loads.
    const selectedType = identTypes.find(t => t.id === form.identificationTypeId)
    const selectedDocName = selectedType?.name
        ?? mockDocumentTypes.find(d => d.id === form.identificationTypeId)?.name
        ?? ""
    const isPassport = selectedType
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
        (docVerified || isPassport || form.documentImage2 !== null)

    // If the schema didn't load we don't block the button — the backend validates
    // required fields on submit (and surfaces them via notifyError).
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
                        <DocumentUpload label="Foto del documento (frente)" value={form.documentImage1} onChange={(v) => updateField("documentImage1", v)} required id="doc-front" />
                        {!isPassport && (
                            <DocumentUpload label="Foto del documento (reverso)" value={form.documentImage2} onChange={(v) => updateField("documentImage2", v)} required id="doc-back" />
                        )}
                        {isPassport && (
                            <p className="text-xs text-slate-400 text-center mt-1">Para pasaporte solo se requiere la página de datos.</p>
                        )}
                    </div>
                </CollapsibleSection>
            )}

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
