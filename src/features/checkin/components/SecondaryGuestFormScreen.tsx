"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { getErrorMessage, notifyError } from "@/lib/notify-error"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { CatalogService, type IdentificationTypeOption, type CatalogOption, type CountryOption } from "@/features/auth/services/catalog-service"
import type { GuestFormData, GuestFormSchemaResponse } from "@/features/checkin/types/checkin"
import { useLocalStorage } from "@/features/checkin/hooks/useLocalStorage"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { getVerificationToken } from "@/features/checkin/lib/verification-token"
import { useVerificationRecovery } from "@/features/checkin/hooks/useVerificationRecovery"
import { isDocumentAlreadyVerified, resolvePreFormVerificationStep } from "@/features/checkin/lib/doc-verification"
import { isDocumentExpired } from "@/features/checkin/lib/document-expiry"
import { classifyCompleteFailure } from "@/features/checkin/lib/complete-failure"
import { asCheckinError } from "@/features/checkin/lib/checkin-error"
import { buildSecondaryCompletionPayload } from "@/features/checkin/lib/secondary-completion"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { FormInput } from "@/features/checkin/components/FormInput"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import { DocumentTypeNumberFields } from "@/features/checkin/components/DocumentTypeNumberFields"
import { BirthdateGenderFields } from "@/features/checkin/components/BirthdateGenderFields"
import { DynamicCheckinFields, areDynamicFieldsValid, getProviderUserFields } from "@/features/checkin/components/DynamicCheckinFields"
import { CollapsibleSection } from "@/features/checkin/components/CollapsibleSection"
import { mockDocumentTypes, mockGenders } from "@/features/checkin/data/mock-guest-data"
import { DocumentUpload } from "@/features/checkin/components/DocumentUpload"
import { ArrowLeft, User, FileText, Globe, Plane, Loader2, CheckCircle2, ClipboardList, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SecondaryGuestFormScreenProps {
    reservationUuid: string
    guestToken: string
    basePath: string
}

export function SecondaryGuestFormScreen({ reservationUuid, guestToken, basePath }: SecondaryGuestFormScreenProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const expireVerificationSession = useVerificationRecovery(reservationUuid, basePath)
    const { load } = useIdentifySession(reservationUuid)
    const routedGuestUuid = searchParams.get("guest_uuid") || ""
    const session = load(routedGuestUuid || undefined)
    const guestUuid = routedGuestUuid || session?.guestUuid || ""

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
    const [countriesRaw, setCountriesRaw] = useState<CountryOption[]>([])
    const [tripReasonOptions, setTripReasonOptions] = useState<Array<{ id: number; label: string }>>([])
    const [identTypes, setIdentTypes] = useState<IdentificationTypeOption[]>([])
    const [genders, setGenders] = useState<CatalogOption[]>([])

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
        const fetchSchema = async () => {
            try {
                const savedSchema = session?.formSchema as unknown as GuestFormSchemaResponse | undefined
                // Identification types are loaded separately, per the document country (ISO2).
                const [countries, reasons, genderList] = await Promise.all([
                    new CatalogService().getCountries(),
                    new CatalogService().getReasonsForTrip(),
                    new CatalogService().getGenders(),
                ])
                setCountriesRaw(countries || [])
                setCountryOptions((countries || []).map((c) => ({ id: Number(c.id), label: c.name })))
                setTripReasonOptions((reasons || []).map((r) => ({ id: Number(r.id), label: r.name })))
                setGenders(genderList || [])

                // Quién puede saltarse las fotos: estado del portal, o el token que
                // emitió el backend al aprobar el OTP. Nunca una bandera del front
                // (ver `doc-verification.ts`). El token se lee antes del portal para
                // que siga contando aunque la llamada falle.
                const hasOtpToken = getVerificationToken(reservationUuid, guestUuid) !== null
                try {
                    const [portalResult, verificationResult] = await Promise.allSettled([
                        checkinService.getPortal(reservationUuid),
                        checkinService.checkVerificationResult(reservationUuid, guestUuid),
                    ])
                    if (portalResult.status === "rejected") {
                        console.error(
                            "[SecondaryGuestFormScreen] getPortal() falló; se usa /verify/result como respaldo",
                            portalResult.reason,
                        )
                    }
                    const portal = portalResult.status === "fulfilled" ? portalResult.value : null
                    const currentGuest = portal?.registeredGuests?.find((guest) => guest.uuid === guestUuid)
                    const activeResult = verificationResult.status === "fulfilled"
                        ? verificationResult.value
                        : null
                    const identityVerified = session?.verification.type === "verified_ok"
                        || isDocumentAlreadyVerified(currentGuest, hasOtpToken, activeResult)
                    setDocVerified(identityVerified)
                    const nextStep = resolvePreFormVerificationStep({
                        identityVerified,
                        resultStatus: activeResult?.status,
                        directiveType: session?.verification.type,
                        portalStatus: portal?.portalStatus,
                        contactChallengeSatisfied: hasOtpToken,
                    })
                    if (nextStep !== "form") {
                        const target = nextStep === "home"
                            ? basePath
                            : nextStep === "contact_challenge"
                            ? `${basePath}/contact-challenge?guest_uuid=${guestUuid}`
                            : nextStep === "verify"
                                ? `${basePath}/verify?guest_uuid=${guestUuid}`
                                : `${basePath}/identify`
                        router.replace(target)
                        return
                    }
                } catch (e) {
                    // Mismo motivo que en GuestFormScreen: tragado en silencio, el
                    // síntoma era indistinguible de un bug de la regla misma.
                    console.error(
                        "[SecondaryGuestFormScreen] getPortal() falló; no se pudo leer el estado de verificación del huésped",
                        e,
                    )
                    setDocVerified(isDocumentAlreadyVerified(undefined, hasOtpToken))
                }

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
                    } catch (raw: unknown) {
                        if (asCheckinError(raw).status === 401) {
                            // Plan OTP 20260731: token ausente/vencido — /identify
                            // retoma el desafío por su flujo de "resume". El error
                            // viaja para decidir por su `code` (2026-08-24).
                            expireVerificationSession(guestUuid, raw)
                            return
                        }
                        console.warn("[SecondaryGuestFormScreen] /form endpoint unavailable; using identify session schema")
                    }
                }
                setSchema(resSchema)

                const prefilledData = resSchema?.prefilledData
                if (prefilledData) {
                    // Also check for OCR data saved by VerifyScreen's handleOcrConfirm
                    const ocrOverrides: Record<string, unknown> = {}
                    try {
                        const ocrKey = `checkin-ocr-data-${reservationUuid}-${guestUuid}`
                        const raw = guestUuid ? localStorage.getItem(ocrKey) : null
                        if (raw) {
                            const ocr = JSON.parse(raw) as Partial<Record<
                                "firstName" | "lastName" | "documentNumber" | "dateOfBirth" | "expirationDate",
                                string
                            >>
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
                        // El prefill es dinámico por definición: las claves salen del
                        // schema que manda el backend, no del tipo. Se trabaja sobre un
                        // registro indexable y se reconvierte al salir, así el cast
                        // queda en UN punto acotado en vez de apagar el chequeo de todo
                        // el bloque con `any`.
                        const updated: Record<string, unknown> = { ...prev }
                        const schemaIncludes = (key: string) =>
                            resSchema?.requiredFields.includes(key)
                            || resSchema?.optionalFields.includes(key)
                        // prefilledData from backend: apply when field is empty OR still at its hardcoded default
                        Object.entries(prefilledData).forEach(([k, v]) => {
                            if ((k === "email" || k === "phone") && !schemaIncludes(k)) return
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
                        // email is NOT cleared when absent from schema — always required
                        // now (OTP plan 20260731); wiping it here would erase what the
                        // guest already typed on a remount.
                        if (!schemaIncludes("phone")) updated.phone = ""
                        return updated as Partial<GuestFormData>
                    })
                }
            } catch {
                toast.error("Error al cargar configuración del formulario")
            } finally {
                setIsLoadingSchema(false)
            }
        }
        
        fetchSchema()
        // `session` sale de leer localStorage en cada render, así que su identidad
        // cambia siempre: incluirlo re-dispararía la carga del schema en bucle.
        // `expireVerificationSession` solo se invoca dentro del catch del 401.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const updateField = <K extends keyof GuestFormData>(field: K, value: GuestFormData[K]) => {
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

    // phone is NOT hardcoded — only required when schema says so. email IS
    // hardcoded required for every guest (OTP plan 20260731) — see GuestFormScreen
    // for why this can't be left to a schema flag.
    const baseValid =
        form.documentCountryId !== "" &&
        form.identificationTypeId !== "" &&
        String(form.identificationNumber ?? "").trim() !== "" &&
        String(form.name ?? "").trim() !== "" &&
        String(form.lastname ?? "").trim() !== "" &&
        form.dateOfBirth !== "" &&
        String(form.email ?? "").trim() !== "" &&
        (docVerified || form.documentImage1 !== null) &&
        (docVerified || isSingleSidedDoc || form.documentImage2 !== null)

    // A missing schema must not permanently disable the button — the backend
    // validates required fields on submit (and surfaces them via notifyError).
    const dynamicValid = schema?.requiredFields.every(key => {
        const val = form[key as keyof GuestFormData]
        return val !== null && val !== "" && val !== undefined
    }) ?? true

    const userFieldsValid = areDynamicFieldsValid(dynamicFields, dynamicValues)

    // Mismo motivo que en GuestFormScreen (§A.4): /secondary/complete exige que
    // el documento no esté vencido, pero el portal reporta `approved` igual.
    // Acá el acompañante SÍ puede editar la fecha, así que el corte es inmediato.
    const documentExpired = isDocumentExpired(
        (form as Record<string, unknown>).identificationExpiryDate as string | undefined,
    )

    const isFormValid = baseValid && dynamicValid && userFieldsValid && !documentExpired

    // Catalogs loaded separately via CatalogService (not included in formSchema response)
    const docTypeOptions = identTypes.length > 0
        ? identTypes.map((d) => ({ id: d.id, label: d.name }))
        : mockDocumentTypes.map((d) => ({ id: d.id, label: d.nameTranslations.es }))
    const genderOptions = genders.length > 0
        ? genders.map((g) => ({ id: Number(g.id), label: g.name }))
        : mockGenders.map((g) => ({ id: g.id, label: g.nameTranslations.es }))

    const nextPath = `${basePath}/success?guest_uuid=${guestUuid}`

    const handleSubmit = async () => {
        if (!guestUuid) return
        setIsSubmitting(true)
        try {
            const payload = buildSecondaryCompletionPayload(form)

            // Backend only returns { message } — re-fetch portal for updated state
            await checkinService.completeSecondaryGuest(reservationUuid, guestUuid, payload)
            
            // Clean up form data and mark this secondary guest as done
            localStorage.removeItem(`checkin-secondary-form-${guestToken}`)
            localStorage.setItem(`checkin-secondary-done-${reservationUuid}-${guestToken}`, 'true')

            // Completion is already committed. A convenience refresh must never
            // turn that success into an error or invite a duplicate submission.
            try {
                const portal = await checkinService.getPortal(reservationUuid)
                toast.success(portal.progress.isFullyCompleted
                    ? "¡Check-in completado para todos los huéspedes!"
                    : "Tus datos fueron registrados correctamente")
            } catch {
                toast.success("Tus datos fueron registrados correctamente")
            }
            router.push(nextPath)
        } catch (raw: unknown) {
            const error = asCheckinError(raw)
            if (error.status === 401) {
                // El token venció entre la pantalla del OTP y este envío. El error
                // viaja para que la recuperación decida por su `code` (2026-08-24).
                expireVerificationSession(guestUuid, raw)
            } else if (error.status === 403) {
                // §18 devuelve 403 por DOS causas distintas: "el titular no
                // completó todavía" y "la identidad de este huésped no está
                // verificada". Rotular siempre la primera le mentía al segundo
                // caso —y lo mandaba al inicio, donde no hay nada que resolver—
                // cuando lo que necesita es rehacer su verificación.
                const message = getErrorMessage(error, "No pudimos completar tu registro.")
                toast.error(message)
                if (classifyCompleteFailure(error.status, message) === "main_guest_pending") {
                    router.push(basePath)
                } else {
                    // Su propia identidad no está confirmada: el paso que puede
                    // resolverlo es el de verificación, no el inicio.
                    router.push(`${basePath}/verify?guest_uuid=${guestUuid}`)
                }
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
                    <SearchableSelect label="País del documento" options={countryOptions} value={form.documentCountryId ?? ""} onChange={(v) => updateField("documentCountryId", v)} placeholder="Seleccionar país..." required />
                    <DocumentTypeNumberFields
                        docTypeOptions={docTypeOptions}
                        documentType={form.identificationTypeId as number | ""}
                        onDocumentTypeChange={(v) => updateField("identificationTypeId", v)}
                        documentNumber={form.identificationNumber || ""}
                        onDocumentNumberChange={(v) => updateField("identificationNumber", v)}
                    />
                </div>
            </CollapsibleSection>

            {/* ── Personal Section ── */}
            <CollapsibleSection icon={<User size={18} />} title="Datos personales" expanded={expanded.personal} onToggle={() => toggleSection("personal")} badge={form.name && form.lastname ? "✓" : undefined}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FormInput label="Nombre" value={form.name || ""} onChange={(v) => updateField("name", v)} placeholder="Ej. Ricardo" required />
                        <FormInput label="Apellidos" value={form.lastname || ""} onChange={(v) => updateField("lastname", v)} placeholder="Ej. Lombana" required />
                    </div>
                    <BirthdateGenderFields
                        genderOptions={genderOptions}
                        dateOfBirth={form.dateOfBirth || ""}
                        onDateOfBirthChange={(v) => updateField("dateOfBirth", v)}
                        gender={form.genderId as number | ""}
                        onGenderChange={(v) => updateField("genderId", v)}
                    />
                    {isFieldVisible('phone') && (
                        <FormInput label="Teléfono / WhatsApp" value={form.phone || ""} onChange={(v) => updateField("phone", v)} placeholder="+57 300 123 4567" type="tel" required={isFieldRequired('phone')} />
                    )}
                    {/* Always visible + required (OTP plan 20260731) — see GuestFormScreen. */}
                    <FormInput label="Email" value={form.email || ""} onChange={(v) => updateField("email", v)} placeholder="correo@ejemplo.com" type="email" required />
                </div>
            </CollapsibleSection>

            {/* ── Origin/Destination Section ── */}
            {showOriginSection && (
                <CollapsibleSection icon={<Globe size={18} />} title="Origen y destino" expanded={expanded.origin} onToggle={() => toggleSection("origin")} badge={form.nationalityId && form.countryOfOriginId && form.countryDestinationId ? "✓" : undefined}>
                    <div className="space-y-4">
                        {isFieldVisible('nationalityId') && (
                            <SearchableSelect label="Nacionalidad" options={countryOptions} value={form.nationalityId ?? ""} onChange={(v) => updateField("nationalityId", v)} placeholder="Seleccionar país..." required={isFieldRequired('nationalityId')} />
                        )}
                        
                        {(isFieldVisible('countryOfResidenceId') || isFieldVisible('cityOfResidence')) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {isFieldVisible('countryOfResidenceId') && (
                                    <SearchableSelect label="País de residencia" options={countryOptions} value={form.countryOfResidenceId ?? ""} onChange={(v) => updateField("countryOfResidenceId", v)} placeholder="Seleccionar..." required={isFieldRequired('countryOfResidenceId')} />
                                )}
                                {isFieldVisible('cityOfResidence') && (
                                    <FormInput label="Ciudad de residencia" value={form.cityOfResidence || ""} onChange={(v) => updateField("cityOfResidence", v)} placeholder="Ej. Bogotá" required={isFieldRequired('cityOfResidence')} />
                                )}
                            </div>
                        )}

                        {isFieldVisible('countryOfOriginId') && (
                            <SearchableSelect label="País de origen (de dónde viene)" options={countryOptions} value={form.countryOfOriginId ?? ""} onChange={(v) => updateField("countryOfOriginId", v)} placeholder="Seleccionar país..." required={isFieldRequired('countryOfOriginId')} />
                        )}

                        {isFieldVisible('cityOfOrigin') && (
                            <FormInput label="Ciudad de origen" value={form.cityOfOrigin || ""} onChange={(v) => updateField("cityOfOrigin", v)} placeholder="Ej. Bogotá" required={isFieldRequired('cityOfOrigin')} />
                        )}

                        {(isFieldVisible('countryDestinationId') || isFieldVisible('cityDestination')) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {isFieldVisible('countryDestinationId') && (
                                    <SearchableSelect label="País destino" options={countryOptions} value={form.countryDestinationId ?? ""} onChange={(v) => updateField("countryDestinationId", v)} placeholder="Seleccionar..." required={isFieldRequired('countryDestinationId')} />
                                )}
                                {isFieldVisible('cityDestination') && (
                                    <FormInput label="Ciudad destino" value={form.cityDestination || ""} onChange={(v) => updateField("cityDestination", v)} placeholder="Ej. Cali" required={isFieldRequired('cityDestination')} />
                                )}
                            </div>
                        )}

                        {isFieldVisible('reasonForTripId') && (
                            <div className="space-y-1.5">
                                <SearchableSelect label="Razón del viaje" options={tripReasonOptions} value={form.reasonForTripId ?? ""} onChange={(v) => updateField("reasonForTripId", v)} placeholder="Seleccionar motivo..." required={isFieldRequired('reasonForTripId')} />
                            </div>
                        )}
                    </div>
                </CollapsibleSection>
            )}

            {/* ── Travel Section (optional) ── */}
            {(isFieldVisible('arrivalTime') || isFieldVisible('departureTime') || isFieldVisible('arrivalFlight') || isFieldVisible('departureFlight')) && (
                <CollapsibleSection icon={<Plane size={18} />} title="Información de viaje" expanded={expanded.travel} onToggle={() => toggleSection("travel")} optional>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

            {/* El documento venció: /secondary/complete lo rechaza con 403, así que
                se avisa acá en vez de dejar que lo descubra al enviar. */}
            {documentExpired && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
                    <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-800">El documento está vencido</p>
                        <p className="text-xs text-red-700 mt-0.5">
                            No podemos completar el registro con un documento de identidad vencido.
                            Revisa la fecha o contacta al anfitrión.
                        </p>
                    </div>
                </div>
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
