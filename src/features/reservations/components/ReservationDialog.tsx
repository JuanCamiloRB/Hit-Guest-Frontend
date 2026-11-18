"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { parseAmountText } from "@/lib/amount-text"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { Form } from "@/components/ui/form"
import { Icon } from "@/components/ui/icon"
import { Note } from "@/components/ui/note"
import { Skeleton } from "@/components/ui/skeleton"
import { normalizeApiError, notifyError } from "@/lib/notify-error"
import { inactiveResourceAction, readInactiveResourceError } from "@/lib/inactive-resource"
import { formatMoney } from "@/lib/money"
import { parseCalendarDate } from "@/lib/calendar-date"
import { readReservationChannel } from "@/lib/reservation-channel"
import { propertiesService } from "@/features/properties/services/properties-service"
import { listingsService } from "@/features/properties/services/listings-service"
import { reservationsService } from "@/features/reservations/services/reservations-service"
import { createReservationWithFollowUp } from "@/features/reservations/lib/create-reservation-followup"
import { readGuestNameParts } from "@/features/reservations/lib/guest-name"
import { describeImportedReservationNotice, readReservationOrigin, type ReservationOrigin } from "../lib/reservation-origin"
import { readReservationFieldErrors } from "../lib/reservation-edit-errors"
import { BOOKING_RULE, bookingBlock, reservationOperability } from "../lib/reservation-availability"
import {
    FORM_FIELD_BY_API_KEY,
    buildReservationPayload,
    reservationSchema,
    type ReservationFormInput,
    type ReservationFormValues,
} from "./reservation-form/payload"
import { nightsBetween, prefillFromListing, pricePerNight, readListingDefaults, type ListingDefaults, type PrefillTouched } from "./reservation-form/stay"
import { useReservationCatalogs } from "./reservation-form/useReservationCatalogs"
import { StaySection } from "./reservation-form/StaySection"
import { PrimaryGuestSection } from "./reservation-form/PrimaryGuestSection"
import { ReservationValueSection } from "./reservation-form/ReservationValueSection"
import { CheckinLinkSection } from "./reservation-form/CheckinLinkSection"
import { ReservationSummary } from "./reservation-form/ReservationSummary"

/**
 * Crear o editar una reserva manual.
 *
 * Rediseño 2026-11-16 (plan `20261116_reserva-manual-ux.md`): los mismos 13
 * campos y el mismo payload de antes (`reservation-form/payload.ts`, fijado por
 * pruebas), en el orden del PM —estancia, titular, valor, envío del link— con
 * resumen para confirmar y la acción principal siempre a la vista.
 */

interface ReservationDialogProps {
    mode?: "create" | "edit"
    reservationUuid?: string
    trigger?: React.ReactNode
}

const EMPTY_VALUES: ReservationFormInput = {
    guestName: "", guestLastname: "", guestCountry: "", emailGuest: "", guestPhone: "",
    propertyUuid: "", listingId: "", reservationSourceId: "",
    dates: { from: undefined, to: undefined },
    totalGuests: 1, totalPrice: "", currency: "COP", sendLinkNow: true,
}

const UNTOUCHED: PrefillTouched = { totalGuests: false, totalPrice: false, currency: false }

const SMALL_SCREEN = "(max-width: 640px)"

/** Solo decide cuántos meses muestra el calendario (que no se pinta hasta abrirlo). */
function useSmallScreen(): boolean {
    const [isSmallScreen, setIsSmallScreen] = useState(() => typeof window !== "undefined" && window.matchMedia(SMALL_SCREEN).matches)
    useEffect(() => {
        const mq = window.matchMedia(SMALL_SCREEN)
        const handler = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return isSmallScreen
}

/**
 * Mientras llega la reserva a editar, la forma de los campos (no un formulario
 * vacío que después cambia solo, ni un spinner suelto).
 */
function EditLoadingSkeleton() {
    return (
        <div className="space-y-8" role="status" aria-label="Cargando la reserva">
            {[3, 3, 1].map((rows, section) => (
                <div key={section} className="space-y-4">
                    <Skeleton className="h-5 w-40" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {Array.from({ length: rows * 2 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <span className="sr-only">Cargando la reserva…</span>
        </div>
    )
}

export function ReservationDialog({ mode = "create", reservationUuid, trigger }: ReservationDialogProps) {
    const isCreate = mode !== "edit"
    const [open, setOpen] = useState(false)
    const [confirmingDiscard, setConfirmingDiscard] = useState(false)
    const isSmallScreen = useSmallScreen()
    const catalogs = useReservationCatalogs()

    // Tres esperas distintas, cada una con su forma: cargar la reserva (edición),
    // los catálogos (en el hook, por catálogo) y enviar (el botón).
    const [isLoadingReservation, setIsLoadingReservation] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    // Tras un envío inválido, el aviso cuenta los errores EN VIVO: al corregir
    // los campos, baja y desaparece sin esperar otro envío.
    const [showInvalidSummary, setShowInvalidSummary] = useState(false)

    // En edición, la propiedad y el alojamiento que la reserva ya tiene: se
    // pueden conservar aunque estén inactivos (solo se bloquea CREAR).
    const [editOriginal, setEditOriginal] = useState<{ propertyUuid: string; listingId: string } | null>(null)
    // Al editar, el canal que ya tiene la reserva: si el catálogo falla o no lo
    // trae, se ofrece igual, para que se vea y se reenvíe tal cual.
    const [editSource, setEditSource] = useState<{ id: number; name: string } | null>(null)
    // Origen técnico de la reserva en edición: solo informa, nunca bloquea
    // (decisión de producto del backend: el PM manda y el PMS gana después).
    const [editingOrigin, setEditingOrigin] = useState<ReservationOrigin | null>(null)

    // Lo que sugiere el alojamiento elegido (capacidad, precio, moneda) y si el
    // precio que se ve sigue siendo el sugerido.
    const [listingDefaults, setListingDefaults] = useState<ListingDefaults | null>(null)
    const [priceSuggested, setPriceSuggested] = useState(false)
    // Campos que el PM tocó: la precarga (que llega tarde) no los pisa.
    const touchedRef = useRef<PrefillTouched>({ ...UNTOUCHED })
    const listingDetailRequestRef = useRef(0)
    // Tras un «Reintentar» que funciona, el foco pasa al selector de canal.
    const channelTriggerRef = useRef<HTMLButtonElement>(null)

    const form = useForm<ReservationFormInput, unknown, ReservationFormValues>({
        resolver: zodResolver(reservationSchema),
        defaultValues: EMPTY_VALUES,
    })
    const { loadListings, loadAll } = catalogs
    // Leído en el render a propósito: `formState` es un proxy y solo informa lo
    // que se lee aquí; leerlo solo dentro del callback de cerrar lo dejaba en falso.
    const { isDirty, errors } = form.formState
    const invalidCount = showInvalidSummary ? Object.keys(errors).length : 0

    const selectedPropertyUuid = form.watch("propertyUuid")
    const selectedListingId = form.watch("listingId")
    const selectedSourceId = form.watch("reservationSourceId")
    const selectedDates = form.watch("dates") as { from?: Date; to?: Date } | undefined
    const guests = Number(form.watch("totalGuests")) || 0
    const rawPrice = String(form.watch("totalPrice") ?? "").trim()
    const currency = form.watch("currency")
    const sendLinkNow = form.watch("sendLinkNow") === true
    const nights = nightsBetween(selectedDates?.from, selectedDates?.to)
    // El mismo criterio que el payload (`lib/amount-text`): «650.000» resume 650000, no 650.
    const total = parseAmountText(rawPrice)

    const markTouched = useCallback((key: keyof PrefillTouched) => {
        touchedRef.current[key] = true
        if (key === "totalPrice") setPriceSuggested(false)
    }, [])

    // ── Abrir: catálogos y, al editar, la reserva ──
    useEffect(() => {
        if (!open) return
        loadAll()
        touchedRef.current = { ...UNTOUCHED }
        setListingDefaults(null)
        setPriceSuggested(false)
        setSubmitError(null)
        setShowInvalidSummary(false)
        setEditOriginal(null)
        setEditSource(null)
        setEditingOrigin(null)

        if (mode === "edit" && reservationUuid) {
            let cancelled = false
            const loadReservation = async () => {
                setIsLoadingReservation(true)
                try {
                    const raw = await reservationsService.getRawById(reservationUuid)
                    if (cancelled) return
                    setEditingOrigin(readReservationOrigin(raw))
                    const fromDate = parseCalendarDate(raw.arrivalDate || raw.arrival_date)
                    const toDate = parseCalendarDate(raw.departureDate || raw.departure_date)
                    let propertyUuid: string = raw.listing?.property?.uuid || raw.listing?.propertyUuid || raw.listing?.property_uuid || ""
                    const listingId: string = raw.listing?.uuid || raw.listingId?.toString() || ""
                    // Con alojamiento pero sin propiedad: buscar a cuál pertenece.
                    if (!propertyUuid && listingId) {
                        try {
                            const allProps = await propertiesService.list()
                            for (const prop of allProps) {
                                const propListings = await listingsService.listByProperty(prop.uuid)
                                if (propListings.some((l: { uuid?: string; id?: unknown }) => l.uuid === listingId || l.id === listingId)) {
                                    propertyUuid = prop.uuid
                                    break
                                }
                            }
                        } catch (err) {
                            console.error("[ReservationDialog] Failed to fetch properties to get propertyUuid", err)
                        }
                    }
                    if (cancelled) return
                    setEditOriginal({ propertyUuid, listingId })
                    const ownSourceId = Number(raw.source?.id ?? raw.reservationSourceId ?? raw.reservation_source_id)
                    setEditSource(Number.isInteger(ownSourceId) && ownSourceId > 0
                        ? { id: ownSourceId, name: readReservationChannel(raw)?.name ?? "Canal actual" }
                        : null)
                    form.reset({
                        // Una reserva antigua trae el nombre entero en `guest_name` y
                        // ningún apellido. Se carga tal cual para que el PM lo separe él.
                        guestName: readGuestNameParts(raw.extra).name || raw.mainGuest?.name || raw.emailGuest?.split("@")[0] || "",
                        guestLastname: readGuestNameParts(raw.extra).lastname || raw.mainGuest?.lastname || "",
                        guestCountry: raw.extra?.guestCountry || raw.extra?.guest_country || "",
                        emailGuest: raw.emailGuest || raw.email_guest || "",
                        guestPhone: raw.extra?.guestPhone || raw.extra?.guest_phone || "",
                        propertyUuid,
                        listingId,
                        reservationSourceId: raw.source?.id?.toString() || raw.reservationSourceId?.toString() || raw.reservation_source_id?.toString() || "",
                        dates: { from: fromDate, to: toDate },
                        totalGuests: raw.totalGuests ?? raw.total_guests ?? 1,
                        totalPrice: String(Number(raw.totalPrice || raw.total_price || 0)),
                        currency: raw.currency || "COP",
                        sendLinkNow: false,
                    })
                    // Lo que ya tiene la reserva cuenta como tocado: nada lo pisa.
                    // Los alojamientos los carga el efecto de la propiedad (una sola vez).
                    touchedRef.current = { totalGuests: true, totalPrice: true, currency: true }
                } catch (error) {
                    if (cancelled) return
                    console.error("[ReservationDialog] Error loading reservation for edit:", error)
                    notifyError(error, "Error al cargar los datos de la reserva")
                } finally {
                    if (!cancelled) setIsLoadingReservation(false)
                }
            }
            void loadReservation()
            return () => {
                cancelled = true
                setIsLoadingReservation(false)
            }
        }

        form.reset(EMPTY_VALUES)
        return undefined
    }, [open, mode, reservationUuid, form, loadAll, loadListings])

    // ── Propiedad → alojamientos (solo escribe la última petición) ──
    useEffect(() => {
        if (open && selectedPropertyUuid) void loadListings(selectedPropertyUuid)
    }, [open, selectedPropertyUuid, loadListings])

    const handlePropertyChange = useCallback(() => {
        form.setValue("listingId", "", { shouldDirty: true })
        // Una sugerencia en vuelo del alojamiento anterior ya no aplica.
        listingDetailRequestRef.current++
        // Un precio que solo sugería el alojamiento anterior no se queda como si
        // fuera de esta propiedad: vuelve a vacío (requerido). Lo escrito se respeta.
        if (priceSuggested && !touchedRef.current.totalPrice) {
            form.setValue("totalPrice", "", { shouldDirty: true })
        }
        setListingDefaults(null)
        setPriceSuggested(false)
    }, [form, priceSuggested])

    // Al elegir alojamiento se sugieren huéspedes, precio y moneda, SOLO en lo
    // que el PM no tocó, y solo si la respuesta es la del alojamiento vigente.
    const handleListingChange = useCallback(async (uuid: string) => {
        form.setValue("listingId", uuid, { shouldValidate: true, shouldDirty: true })
        const request = ++listingDetailRequestRef.current
        try {
            const listing = await listingsService.getById(uuid)
            if (request !== listingDetailRequestRef.current || !listing) return
            const defaults = readListingDefaults(listing)
            setListingDefaults(defaults)
            const patch = prefillFromListing(defaults, touchedRef.current)
            if (patch.totalGuests != null) form.setValue("totalGuests", patch.totalGuests, { shouldValidate: true, shouldDirty: true })
            if (patch.totalPrice != null) {
                form.setValue("totalPrice", patch.totalPrice, { shouldValidate: true, shouldDirty: true })
                setPriceSuggested(true)
            }
            if (patch.currency != null) form.setValue("currency", patch.currency, { shouldValidate: true, shouldDirty: true })
        } catch {
            // No fatal: se conserva lo que el PM tenía si el alojamiento no se pudo leer.
        }
    }, [form])

    // ── Activos / inactivos ──
    const selectedProperty = catalogs.properties.find((p) => p.uuid === selectedPropertyUuid)
    const selectedListing = catalogs.listings.find((l) => l.uuid === selectedListingId)
    const noActiveProperties = isCreate && !catalogs.loading.properties && catalogs.properties.length > 0
        && !catalogs.properties.some((p) => p.status === "active")
    const noActiveListings = isCreate && selectedProperty?.status === "active" && !catalogs.loading.listings
        && catalogs.listings.length > 0 && !catalogs.listings.some((l) => l.status === "active")
    const selectionBlock = selectedProperty ? bookingBlock(selectedProperty.status, selectedListing?.status ?? null) : null
    const inactiveNotice = !isCreate && selectionBlock
        ? selectionBlock.startsWith("property")
            ? "La propiedad de esta reserva está inactiva: sus automatizaciones están detenidas."
            : "El alojamiento de esta reserva está inactivo: sus automatizaciones están detenidas."
        : null

    // ── Cerrar: con cambios, se confirma ──
    const closeNow = useCallback(() => {
        setConfirmingDiscard(false)
        setOpen(false)
        form.reset(EMPTY_VALUES)
    }, [form])

    const requestClose = useCallback(() => {
        if (isSubmitting) return
        if (isDirty) setConfirmingDiscard(true)
        else closeNow()
    }, [isSubmitting, isDirty, closeNow])

    const handleOpenChange = useCallback((next: boolean) => {
        if (next) setOpen(true)
        else requestClose()
    }, [requestClose])

    // ── Enviar ──
    const onInvalid = useCallback(() => {
        setShowInvalidSummary(true)
        setSubmitError(null)
    }, [])

    async function onValid(values: ReservationFormValues) {
        setShowInvalidSummary(false)
        setSubmitError(null)
        // Última validación local antes del POST/PUT (el backend es la autoridad
        // final). Crear exige todo activo; editar solo si MUEVE la reserva.
        const property = catalogs.properties.find((p) => p.uuid === values.propertyUuid)
        const listing = catalogs.listings.find((l) => l.uuid === values.listingId)
        const operability = reservationOperability({
            operation: isCreate ? "create" : "edit",
            propertyStatus: property?.status ?? "unknown",
            listingStatus: listing?.status ?? "unknown",
            listingChanged: !isCreate && !!editOriginal && values.listingId !== editOriginal.listingId,
        })
        if (!operability.allowed) {
            form.setError(operability.reason.startsWith("property") ? "propertyUuid" : "listingId", {
                type: "inactive",
                message: operability.message,
            })
            return
        }
        // Defensa: el botón ya está deshabilitado en este caso.
        if (isCreate && catalogs.sourcesFailed) return
        setIsSubmitting(true)

        const payload = buildReservationPayload(values, { mode: isCreate ? "create" : "edit", countries: catalogs.countries })

        try {
            if (!isCreate && reservationUuid) {
                await reservationsService.update(reservationUuid, payload)
                toast.success("Reserva actualizada exitosamente", { description: "Los cambios han sido guardados." })
            } else {
                // El link solo sale solo al IMPORTAR; en una manual lo pide el
                // front si el PM dejó la casilla marcada. Si el link falla, la
                // reserva YA existe: el aviso lo distingue.
                const outcome = await createReservationWithFollowUp({
                    payload,
                    sendLinkNow: values.sendLinkNow === true,
                    guestName: `${values.guestName} ${values.guestLastname}`,
                    email: values.emailGuest,
                })
                if (outcome.tone === "success") {
                    toast.success(outcome.title, { description: outcome.description })
                } else {
                    // La reserva YA existe: el aviso lleva a su ficha, donde se reenvía el link.
                    const createdUuid = outcome.reservationUuid
                    toast.warning(outcome.title, {
                        description: outcome.description,
                        duration: 8000,
                        ...(createdUuid
                            ? { action: { label: "Ver reserva", onClick: () => window.location.assign(`/dashboard/reservations/${createdUuid}`) } }
                            : {}),
                    })
                }
            }
            closeNow()
            window.dispatchEvent(new Event("reservationCreated"))
        } catch (error: unknown) {
            console.error("[ReservationDialog] Submit error:", error)
            const title = isCreate ? "No se pudo crear la reserva" : "No se pudo actualizar la reserva"
            // Algo se desactivó después de abrir el formulario: se conserva el
            // borrador, se muestra el mensaje del backend y se releen los estados.
            const inactive = readInactiveResourceError(error)
            if (inactive) {
                const manage = inactiveResourceAction(inactive, values.propertyUuid)
                form.setError("listingId", { type: "inactive", message: inactive.message })
                setSubmitError(inactive.message)
                toast.error(title, {
                    description: inactive.message,
                    ...(manage ? { action: { label: manage.label, onClick: () => window.location.assign(manage.href) } } : {}),
                })
                void catalogs.loadProperties()
                if (values.propertyUuid) void loadListings(values.propertyUuid)
                return
            }
            // 422 con claves de campo: cada mensaje (ya localizado) se ancla al
            // control real. Las claves que este formulario no edita caen al aviso.
            const fieldErrors = readReservationFieldErrors(error)
            let anchored = 0
            for (const fieldError of fieldErrors) {
                const formField = FORM_FIELD_BY_API_KEY[fieldError.field]
                if (!formField) continue
                form.setError(formField, { type: "server", message: fieldError.message })
                anchored++
            }
            if (fieldErrors.length > 0) {
                setSubmitError(anchored === fieldErrors.length ? "Revisa los campos marcados." : fieldErrors[0].message)
                toast.error(title, { description: fieldErrors[0].message })
            } else {
                const normalized = normalizeApiError(error, isCreate ? "Error al crear la reserva" : "Error al actualizar la reserva")
                setSubmitError(normalized.message)
                notifyError(error, isCreate ? "Error al crear la reserva" : "Error al actualizar la reserva")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const retrySources = useCallback(async () => {
        if (catalogs.loading.sources) return
        if (await catalogs.loadSources()) {
            requestAnimationFrame(() => channelTriggerRef.current?.focus())
        }
    }, [catalogs])

    const ctaLabel = !isCreate ? "Guardar cambios" : sendLinkNow ? "Crear y enviar link" : "Crear reserva"
    const channelName = (catalogs.sources.find((s) => String(s.id) === selectedSourceId) ?? (editSource && String(editSource.id) === selectedSourceId ? editSource : null))?.name ?? null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button>
                        <Icon icon={Plus} />
                        Nueva reserva
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent layout="panel" className="sm:max-w-5xl">
                <DialogHeader divided>
                    <DialogTitle>{isCreate ? "Nueva reserva" : "Editar reserva"}</DialogTitle>
                    <DialogDescription>
                        {isCreate
                            ? "Regístrala y, si quieres, envía al huésped el link de su check-in online."
                            : "Edita los detalles de la reserva seleccionada."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onValid, onInvalid)} className="contents">
                        <DialogBody className="lg:flex lg:items-start lg:gap-8">
                            <div className="min-w-0 flex-1 space-y-8">
                                {!isCreate && editingOrigin?.isImported && (
                                    <FeedbackBanner tone="warning">{describeImportedReservationNotice(editingOrigin)}</FeedbackBanner>
                                )}
                                {invalidCount > 0 && (
                                    <FeedbackBanner tone="danger" mode="blocking">
                                        {invalidCount === 1 ? "Falta 1 campo. Lo marcamos abajo." : `Faltan ${invalidCount} campos. Los marcamos abajo.`}
                                    </FeedbackBanner>
                                )}
                                {submitError && (
                                    <FeedbackBanner tone="danger" mode="blocking">{submitError}</FeedbackBanner>
                                )}
                                {isCreate && <Note>{BOOKING_RULE}</Note>}

                                {isLoadingReservation && <EditLoadingSkeleton />}
                                <div className={isLoadingReservation ? "hidden" : "space-y-8"}>

                                <StaySection
                                    mode={mode}
                                    catalogs={catalogs}
                                    editOriginal={editOriginal}
                                    editSource={editSource}
                                    channelTriggerRef={channelTriggerRef}
                                    onRetrySources={() => void retrySources()}
                                    onPropertyChange={handlePropertyChange}
                                    onListingChange={(uuid) => void handleListingChange(uuid)}
                                    onGuestsEdited={() => markTouched("totalGuests")}
                                    capacity={listingDefaults?.guests ?? null}
                                    inactiveNotice={inactiveNotice}
                                    noActiveProperties={noActiveProperties}
                                    noActiveListings={noActiveListings}
                                    isSmallScreen={isSmallScreen}
                                />
                                <PrimaryGuestSection
                                    countries={catalogs.countries}
                                    loadingCountries={catalogs.loading.countries}
                                    countriesFailed={catalogs.failed.countries}
                                    onRetryCountries={() => void catalogs.loadCountries()}
                                />
                                <ReservationValueSection
                                    currencies={catalogs.currencies}
                                    loadingCurrencies={catalogs.loading.currencies}
                                    currenciesFailed={catalogs.failed.currencies}
                                    onRetryCurrencies={() => void catalogs.loadCurrencies()}
                                    nights={nights}
                                    priceSuggested={priceSuggested}
                                    onPriceEdited={() => markTouched("totalPrice")}
                                    onCurrencyEdited={() => markTouched("currency")}
                                />
                                <CheckinLinkSection mode={mode} />
                                </div>
                            </div>
                            <ReservationSummary
                                className="hidden shrink-0 lg:sticky lg:top-0 lg:block lg:w-72"
                                data={{
                                    propertyName: selectedProperty?.name ?? null,
                                    listingName: selectedListing?.name ?? null,
                                    channelName,
                                    from: selectedDates?.from,
                                    to: selectedDates?.to,
                                    nights,
                                    guests,
                                    total,
                                    perNight: pricePerNight(total, nights),
                                    currency,
                                    mode,
                                    sendLinkNow,
                                }}
                            />
                        </DialogBody>

                        <DialogFooter divided className="sm:items-center">
                            <Button type="button" variant="outline" onClick={requestClose} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoadingReservation || (isCreate && (catalogs.sourcesFailed || catalogs.loading.sources))}
                                loading={isSubmitting}
                                loadingLabel={isCreate ? "Creando reserva…" : "Guardando…"}
                                className="min-w-44"
                            >
                                {isCreate && sendLinkNow && <Icon icon={Send} />}
                                {ctaLabel}
                            </Button>
                            {/* Último en el DOM: con `flex-col-reverse` queda ARRIBA de los botones
                                en móvil; en escritorio `order-first` lo pone a la izquierda. */}
                            <p className="text-xs text-ink-3 sm:order-first sm:mr-auto">
                                <span className="hidden sm:inline"><span className="text-danger">*</span> Campos obligatorios</span>
                                {/* En móvil no hay columna de resumen: se condensa aquí. */}
                                <span className="sm:hidden">
                                    {selectedListing
                                        ? <>
                                            {nights > 0 ? `${nights} ${nights === 1 ? "noche" : "noches"} · ` : ""}{guests} {guests === 1 ? "huésped" : "huéspedes"}
                                            {total != null && total > 0 ? ` · ${formatMoney(total, currency)}` : total === 0 ? " · Sin costo" : ""}
                                        </>
                                        : <><span className="text-danger">*</span> Campos obligatorios</>}
                                </span>
                            </p>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>

            <AlertDialog open={confirmingDiscard} onOpenChange={(next) => { if (!next) setConfirmingDiscard(false) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isCreate ? "¿Descartar la reserva?" : "¿Descartar los cambios?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isCreate ? "Lo que escribiste se pierde. La reserva no se crea." : "Los cambios no se guardan."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Seguir editando</AlertDialogCancel>
                        <AlertDialogAction onClick={closeNow}>Descartar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    )
}
