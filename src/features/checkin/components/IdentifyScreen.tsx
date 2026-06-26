"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, ShieldCheck, Users } from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import { CatalogService } from "@/features/auth/services/catalog-service"
import type { IdentifyPayload, IdentifySessionData } from "@/features/checkin/types/checkin"

interface IdentifyScreenProps {
    reservationUuid: string
    basePath: string
    isMainGuest?: boolean
    isSecondary?: boolean
}

export function IdentifyScreen({ reservationUuid, basePath, isMainGuest = true, isSecondary = false }: IdentifyScreenProps) {
    const router = useRouter()
    const { save, saveRaw } = useIdentifySession(reservationUuid)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true)
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof IdentifyPayload, string>>>({})

    const [form, setForm] = useState<{
        name: string
        lastname: string
        nationalityId: number | ""
        identificationTypeId: number | ""
        identificationNumber: string
    }>({
        name: "",
        lastname: "",
        nationalityId: "",
        identificationTypeId: "",
        identificationNumber: "",
    })

    const [countryOptions, setCountryOptions] = useState<Array<{ id: number; label: string; sublabel?: string }>>([])
    const [docTypeOptions, setDocTypeOptions] = useState<Array<{ id: number; label: string }>>([])

    useEffect(() => {
        const catalogs = new CatalogService()
        let mounted = true
        async function load() {
            try {
                const [countries, docTypes] = await Promise.all([
                    catalogs.getCountries(),
                    catalogs.getIdentificationTypes(),
                ])
                if (!mounted) return
                const mappedCountries = (countries || [])
                    .map((c: any) => ({ id: Number(c.id), label: String(c.name), sublabel: c.extra?.iso2 }))
                    .filter(o => Number.isFinite(o.id))
                const mappedDocTypes = (docTypes || [])
                    .map((d: any) => ({ id: Number(d.id), label: String(d.name) }))
                    .filter(o => Number.isFinite(o.id))
                setCountryOptions(mappedCountries)
                setDocTypeOptions(mappedDocTypes)
            } catch (e) {
                toast.error("No fue posible cargar catálogos. Intenta de nuevo.")
            } finally {
                if (mounted) setIsLoadingCatalogs(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [])

    const isValid =
        form.name.trim().length >= 2 &&
        form.lastname.trim().length >= 2 &&
        form.nationalityId !== "" &&
        form.identificationTypeId !== "" &&
        form.identificationNumber.trim().length > 2

    // Detects the backend's "document already registered in this reservation" error.
    const isDuplicateDocError = (e: any): boolean => {
        if (e?.status === 409) return true
        const blob = `${e?.message ?? ""} ${JSON.stringify(e?.errors ?? {})}`.toLowerCase()
        return blob.includes("registrad") || blob.includes("already registered") || blob.includes("already associated")
    }

    /**
     * Resume an existing (incomplete) guest when /identify is rejected because their
     * document is already registered — e.g. they did biometrics, the Didit callback
     * failed, and they came back. Looks the guest up in the portal and routes them to
     * success (if done) or rebuilds a session and continues to verify.
     */
    const resumeExistingGuest = async (payload: IdentifyPayload): Promise<boolean> => {
        try {
            const portal = await checkinService.getPortal(reservationUuid)
            const norm = (s?: string) => (s ?? "").trim().toLowerCase()
            const match = portal.registeredGuests?.find(g =>
                payload.isMainGuest
                    ? g.isMain
                    : norm(g.name) === norm(payload.name) && norm(g.lastname) === norm(payload.lastname)
            )
            if (!match) return false

            if (match.isCompleted) {
                toast.success("Ya completaste tu check-in anteriormente")
                router.push(`${basePath}/success?guest_uuid=${match.uuid}`)
                return true
            }

            const verif: any = (match as any).verification ?? {}
            const status = String(verif.status ?? "").toLowerCase()
            const step = String(verif.currentStep ?? "").toLowerCase()

            // Already verified by the backend → skip straight to the form.
            if (status === "approved" || status === "completed" || step === "form") {
                try { localStorage.setItem(`checkin-verification-done-${reservationUuid}-${match.uuid}`, "true") } catch {}
                toast.info("Tu identidad ya fue verificada. Continuamos con tus datos.")
                router.push(`${basePath}/guest?guest_uuid=${match.uuid}`)
                return true
            }

            // A pending Didit session is still available → resume that EXACT session.
            // We must NOT invent a "document_upload" directive when there's no URL —
            // that would switch the provider from Didit to Textract. If we can't safely
            // re-derive the original provider, bail and let the backend handle it
            // (identify should be idempotent and return a fresh verification directive).
            if (verif.verificationUrl) {
                const data: IdentifySessionData = {
                    guestUuid: match.uuid,
                    guestName: match.name,
                    guestLastname: match.lastname,
                    isMainGuest: match.isMain,
                    isCheckinCompleted: false,
                    verification: { type: "session", subtype: "biometric", url: verif.verificationUrl },
                    formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
                    timestamp: Date.now(),
                    identificationTypeId: Number(payload.identificationTypeId) || undefined,
                }
                saveRaw(data)
                toast.info("Ya iniciaste tu registro. Continuamos con tu verificación.")
                router.push(`${basePath}/verify?guest_uuid=${match.uuid}`)
                return true
            }

            return false
        } catch {
            return false
        }
    }

    const handleVerify = async () => {
        if (!isValid) return
        setIsSubmitting(true)
        setFieldErrors({})

        const payload: IdentifyPayload = {
            name: form.name.trim(),
            lastname: form.lastname.trim(),
            nationalityId: Number(form.nationalityId),
            identificationTypeId: Number(form.identificationTypeId),
            identificationNumber: form.identificationNumber.trim(),
            isMainGuest,
        }

        try {
            const response = await checkinService.identify(reservationUuid, payload)

            // G8: Handle already-completed re-entry
            if (response.reservationGuest.isCheckinCompleted) {
                toast.success("Ya completaste tu check-in anteriormente")
                router.push(`${basePath}/success?guest_uuid=${response.guest.uuid}`)
                return
            }

            // Persist session for downstream screens (verify, guest form)
            // Pass identificationTypeId so VerifyScreen knows if back image is required
            save(response, Number(form.identificationTypeId) || undefined)

            // Store trigger for mock routing in VerifyScreen (checkVerificationResult)
            try {
                const triggerKey = `checkin-ident-trigger-${reservationUuid}-${response.guest.uuid}`
                localStorage.setItem(triggerKey, payload.identificationNumber)
            } catch {}

            // If this guest already completed document upload verification earlier,
            // skip Verify and go straight to the Guest Form (idempotent re-entry UX)
            if (response.verification.type === "document_upload") {
                try {
                    const verificationDoneKey = `checkin-verification-done-${reservationUuid}-${response.guest.uuid}`
                    const alreadyVerified = localStorage.getItem(verificationDoneKey) === 'true'
                    if (alreadyVerified) {
                        toast.success("Documento verificado anteriormente")
                        router.push(`${basePath}/guest?guest_uuid=${response.guest.uuid}`)
                        return
                    }
                } catch {}
            }

            // G2 + G3: Route based on backend-decided verification.type
            switch (response.verification.type) {
                case "verified_ok":
                    // G6: Guest already verified — skip directly to form
                    try {
                        const vKey = `checkin-verification-done-${reservationUuid}-${response.guest.uuid}`
                        localStorage.setItem(vKey, 'true')
                    } catch {}
                    router.push(`${basePath}/guest?guest_uuid=${response.guest.uuid}`)
                    break
                case "session":
                case "document_upload":
                    router.push(`${basePath}/verify?guest_uuid=${response.guest.uuid}`)
                    break
            }
        } catch (e: any) {
            console.error("[IdentifyScreen] 422 error details:", { status: e.status, message: e.message, errors: e.errors })
            // Document already registered → this is almost always the same guest coming
            // back after an interrupted attempt (e.g. failed Didit callback). Resume them
            // instead of dead-ending. Falls through to the error display if not resolvable.
            if (isDuplicateDocError(e)) {
                const resumed = await resumeExistingGuest(payload)
                if (resumed) return
            }
            // G8: Handle specific backend errors
            if (e.status === 403) {
                toast.error("El huésped principal debe completar su registro primero")
                router.push(basePath)
            } else if (e.status === 409) {
                setFieldErrors({ identificationNumber: "Este número de documento ya está registrado en esta reserva." })
                toast.error("Este documento ya está asociado a un huésped en esta reserva")
            } else if (e.status === 422) {
                // Check if it's specifically a max_guests error or a validation error
                if (e.message?.toLowerCase().includes("maximum") || e.message?.toLowerCase().includes("máximo")) {
                    router.push(`${basePath}?error=max_guests`)
                } else if (e.errors && typeof e.errors === 'object') {
                    // Field-level validation errors
                    setFieldErrors(e.errors)
                    toast.error("Por favor revisa los campos marcados")
                } else {
                    notifyError(e, "Error de validación")
                }
            } else if (e.status === 404) {
                toast.error("Reserva no encontrada")
                router.push(basePath)
            } else if (e.errors) {
                // Inline field-level validation errors from backend
                setFieldErrors(e.errors)
                toast.error("Por favor revisa los campos marcados")
            } else {
                notifyError(e, "Error al verificar identidad")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={1} totalSteps={isSecondary ? 3 : 5} />

            <div className="flex items-center justify-between">
                <Link href={basePath} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {isSecondary ? "Paso 1 de 4" : "Paso 2 de 6"}
                </div>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    Verificación de Identidad
                </h1>
                <p className="text-slate-500 text-sm">
                    Necesitamos verificar tu documento para continuar con el registro.
                </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">

                {/* Name + Lastname */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                            Nombres<span className="text-red-400 ml-0.5">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all ${fieldErrors.name ? "border-red-400" : "border-slate-200"}`}
                            placeholder="Ej. Juan Carlos"
                            maxLength={120}
                        />
                        {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                            Apellidos<span className="text-red-400 ml-0.5">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.lastname}
                            onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all ${fieldErrors.lastname ? "border-red-400" : "border-slate-200"}`}
                            placeholder="Ej. Rodríguez Barrera"
                            maxLength={60}
                        />
                        {fieldErrors.lastname && <p className="text-xs text-red-500">{fieldErrors.lastname}</p>}
                    </div>
                </div>

                {/* Nationality (G1: renamed from countryId) */}
                <SearchableSelect
                    label="Nacionalidad"
                    options={countryOptions}
                    value={form.nationalityId}
                    onChange={v => setForm(f => ({ ...f, nationalityId: v }))}
                    placeholder="Seleccionar país..."
                    required
                />

                {/* Doc type + number */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                        <SearchableSelect
                            label="Tipo Doc."
                            options={docTypeOptions}
                            value={form.identificationTypeId}
                            onChange={v => setForm(f => ({ ...f, identificationTypeId: v }))}
                            placeholder="Selec."
                            required
                        />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                            Número de Documento<span className="text-red-400 ml-0.5">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.identificationNumber}
                            onChange={e => {
                                const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, "")
                                setForm(f => ({ ...f, identificationNumber: sanitized }))
                            }}
                            onPaste={e => {
                                e.preventDefault()
                                const text = (e.clipboardData.getData("text") || "").replace(/[^a-zA-Z0-9]/g, "")
                                setForm(f => ({ ...f, identificationNumber: text }))
                            }}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all ${fieldErrors.identificationNumber ? "border-red-400" : "border-slate-200"}`}
                            placeholder="Ej. 1234567890"
                            maxLength={30}
                            inputMode="text"
                            pattern="[A-Za-z0-9]*"
                        />
                        {fieldErrors.identificationNumber && <p className="text-xs text-red-500">{fieldErrors.identificationNumber}</p>}
                    </div>
                </div>

                {/* isMainGuest indicator */}
                {!isSecondary && (
                    <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <Users size={14} />
                        <span>Estás registrando al huésped principal</span>
                    </div>
                )}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">
                    Tus datos están protegidos con cifrado de extremo a extremo y solo se usarán para el check-in.
                </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <button
                        onClick={handleVerify}
                        disabled={!isValid || isSubmitting || isLoadingCatalogs}
                        className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="animate-spin" size={20} /> Verificando...</>
                        ) : (
                            isLoadingCatalogs ? "Cargando..." : "Verificar Identidad"
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
