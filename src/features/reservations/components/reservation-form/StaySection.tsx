"use client"

import { useFormContext } from "react-hook-form"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Combobox } from "@/components/ui/combobox"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { FieldError, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Icon } from "@/components/ui/icon"
import { NumberStepper } from "@/components/ui/number-stepper"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useTranslation } from "@/hooks/useTranslation"
import { propertyEditHref } from "@/features/properties/lib/property-tabs"
import { NO_ACTIVE_LISTINGS, NO_ACTIVE_PROPERTIES, statusTag } from "../../lib/reservation-availability"
import { CatalogError } from "@/components/shared/catalog-error"
import { FormSection } from "./FormSection"
import { RequiredMark } from "@/components/shared/required-mark"
import { nightsBetween } from "./stay"
import type { ReservationFormInput } from "./payload"
import type { useReservationCatalogs } from "./useReservationCatalogs"

type Catalogs = ReturnType<typeof useReservationCatalogs>

interface StaySectionProps {
    mode: "create" | "edit"
    catalogs: Catalogs
    /** En edición, lo que la reserva ya tiene: se conserva aunque esté inactivo. */
    editOriginal: { propertyUuid: string; listingId: string } | null
    /** Al editar, el canal que ya tiene la reserva aunque el catálogo no lo traiga. */
    editSource: { id: number; name: string } | null
    channelTriggerRef: React.RefObject<HTMLButtonElement | null>
    onRetrySources: () => void
    onPropertyChange: (uuid: string) => void
    onListingChange: (uuid: string) => void
    onGuestsEdited: () => void
    /** Capacidad del alojamiento elegido, si la trae. */
    capacity: number | null
    /** Aviso bajo el alojamiento en edición cuando lo original está inactivo. */
    inactiveNotice: string | null
    noActiveProperties: boolean
    noActiveListings: boolean
    isSmallScreen: boolean
}

export function StaySection({
    mode, catalogs, editOriginal, editSource, channelTriggerRef, onRetrySources,
    onPropertyChange, onListingChange, onGuestsEdited, capacity, inactiveNotice,
    noActiveProperties, noActiveListings, isSmallScreen,
}: StaySectionProps) {
    const form = useFormContext<ReservationFormInput>()
    const { t } = useTranslation()
    const isCreate = mode === "create"
    const selectedPropertyUuid = form.watch("propertyUuid")
    const { properties, listings, sources, loading, sourcesFailed } = catalogs
    const isOriginal = (field: "propertyUuid" | "listingId", uuid: string) => !isCreate && editOriginal?.[field] === uuid

    const listingPlaceholder = !selectedPropertyUuid
        ? "Elige primero una propiedad"
        : loading.listings
            ? "Cargando…"
            : listings.length === 0
                ? t("reservations.noListings")
                : "Elige el alojamiento"

    return (
        <FormSection title="Estancia" description="Dónde y cuándo. El alojamiento sugiere huéspedes y precio.">
            <FormField
                control={form.control}
                name="propertyUuid"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Propiedad <RequiredMark /></FormLabel>
                        <FormControl>
                            <Combobox
                                ref={field.ref}
                                value={field.value || null}
                                onValueChange={(value) => { field.onChange(value ?? ""); onPropertyChange(value ?? "") }}
                                options={properties.map((p) => {
                                    const tag = statusTag(p.status, true)
                                    // La etiqueta lleva el estado («Casa Apagada · Inactiva»): es parte del nombre de la opción.
                                    return { value: p.uuid, label: tag ? `${p.name} · ${tag}` : p.name, disabled: !!tag && !isOriginal("propertyUuid", p.uuid) }
                                })}
                                placeholder="Busca una propiedad"
                                searchPlaceholder="Buscar propiedad…"
                                emptyText="No hay propiedades con ese nombre"
                                loading={loading.properties}
                            />
                        </FormControl>
                        {catalogs.failed.properties && (
                            <CatalogError
                                what="las propiedades"
                                consequence="Sin propiedad no se puede crear la reserva."
                                retrying={loading.properties}
                                onRetry={() => void catalogs.loadProperties()}
                            />
                        )}
                        {noActiveProperties && <FieldError role="alert">{NO_ACTIVE_PROPERTIES}</FieldError>}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="listingId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Alojamiento <RequiredMark /></FormLabel>
                            <Select
                                onValueChange={onListingChange}
                                value={field.value}
                                disabled={!selectedPropertyUuid || loading.listings || listings.length === 0}
                            >
                                <FormControl>
                                    <SelectTrigger ref={field.ref} className="w-full">
                                        <SelectValue placeholder={listingPlaceholder} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {listings.map((l) => {
                                        const tag = statusTag(l.status, false)
                                        return (
                                            <SelectItem key={l.uuid} value={l.uuid} disabled={!!tag && !isOriginal("listingId", l.uuid)}>
                                                {l.name}{tag && <>{" "}<span className="text-xs text-ink-3">· {tag}</span></>}
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                            {noActiveListings && (
                                <FieldError role="alert">
                                    {NO_ACTIVE_LISTINGS}{" "}
                                    <Button variant="link" size="inline" asChild>
                                        <Link href={propertyEditHref(selectedPropertyUuid, "units")}>Gestionar alojamientos</Link>
                                    </Button>
                                </FieldError>
                            )}
                            {inactiveNotice && <FeedbackBanner tone="warning" density="compact">{inactiveNotice}</FeedbackBanner>}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="reservationSourceId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Canal de reserva <RequiredMark /></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={loading.sources || sourcesFailed}>
                                <FormControl>
                                    <SelectTrigger ref={channelTriggerRef} className="w-full">
                                        <SelectValue placeholder={loading.sources ? "Cargando…" : "Elige el canal"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {(mode === "edit" && editSource && !sources.some((s) => s.id === editSource.id)
                                        ? [editSource, ...sources]
                                        : sources
                                    ).map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {sourcesFailed && (
                                <CatalogError
                                    what="los canales de reserva"
                                    consequence={mode === "create"
                                        ? "Sin canal no se puede crear la reserva."
                                        : editSource ? "Se conserva el canal actual." : undefined}
                                    retrying={loading.sources}
                                    onRetry={onRetrySources}
                                />
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <FormField
                    control={form.control}
                    name="dates"
                    render={({ field }) => {
                        const value = field.value as { from?: Date; to?: Date } | undefined
                        const nights = nightsBetween(value?.from, value?.to)
                        return (
                            <FormItem className="flex flex-col">
                                <FormLabel>Fechas de estancia <RequiredMark /></FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button ref={field.ref} variant="field" data-placeholder={!value?.from || undefined} className="w-full">
                                                {value?.from ? (
                                                    value.to ? (
                                                        <span className="flex items-center gap-2">
                                                            {format(value.from, "d MMM yyyy", { locale: es })} → {format(value.to, "d MMM yyyy", { locale: es })}
                                                            {nights > 0 && <Badge tone="accent">{nights} {nights === 1 ? "noche" : "noches"}</Badge>}
                                                        </span>
                                                    ) : (
                                                        format(value.from, "d MMM yyyy", { locale: es })
                                                    )
                                                ) : (
                                                    <span>Llegada → salida</span>
                                                )}
                                                <Icon icon={CalendarIcon} className="text-ink-3" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="range"
                                            selected={field.value as { from: Date; to?: Date } | undefined}
                                            onSelect={field.onChange}
                                            numberOfMonths={isSmallScreen ? 1 : 2}
                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )
                    }}
                />
                <FormField
                    control={form.control}
                    name="totalGuests"
                    render={({ field }) => (
                        <FormItem className="sm:w-44">
                            <FormLabel>Huéspedes <RequiredMark /></FormLabel>
                            <FormControl>
                                <NumberStepper
                                    ref={field.ref}
                                    value={Number(field.value) || 1}
                                    onValueChange={(n) => { field.onChange(n); onGuestsEdited() }}
                                    min={1}
                                    decrementLabel="Quitar un huésped"
                                    incrementLabel="Agregar un huésped"
                                />
                            </FormControl>
                            {capacity != null && (
                                <FormDescription>
                                    Capacidad: {capacity}{Number(field.value) > capacity ? " · supera la capacidad" : ""}
                                </FormDescription>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </FormSection>
    )
}
