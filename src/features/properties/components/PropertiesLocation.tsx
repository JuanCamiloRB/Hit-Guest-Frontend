"use client"

import { useFormContext, useFormState } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { useState, useCallback, useEffect, useRef, useId, type ComponentProps } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import {
    catalogService,
    type CatalogOption,
    type CountryOption,
} from "@/features/auth/services/catalog-service"
import { AddressAutocomplete, type PlaceDetails } from "./AddressAutocomplete"
import { resolveMapView } from "../lib/map-view"
import { Surface } from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { DefinitionItem } from "@/components/ui/definition-list"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { CatalogError } from "@/components/shared/catalog-error"
import { RequiredMark } from "@/components/shared/required-mark"

const MapComponent = dynamic(() => import("./MapComponent"), {
    ssr: false,
    loading: () => (
        <Skeleton className="h-full w-full rounded-md" />
    )
})

type TimezoneGroup = { group: string; options: CatalogOption[] }

/**
 * Un catálogo con sus tres estados (cargando, listo, falló) y «Reintentar».
 * País y zona horaria se piden por separado: si uno falla, el otro sigue
 * sirviendo y el PM ve el error junto al campo que sí le falta.
 */
function useCatalog<T>(load: () => Promise<T>, empty: T) {
    const [data, setData] = useState<T>(empty)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)

    // Solo escribe estado cuando la promesa responde: la primera carga arranca
    // ya en «cargando» (estado inicial) y el efecto no escribe nada en el acto.
    const run = useCallback(() => load()
        .then((next) => {
            setData(next)
            setFailed(false)
        }, () => setFailed(true))
        .finally(() => setLoading(false)), [load])

    useEffect(() => {
        void run()
    }, [run])

    // `failed` se conserva durante el reintento: así el aviso dice «Reintentando…»
    // en vez de desaparecer y volver.
    const reload = useCallback(() => {
        setLoading(true)
        void run()
    }, [run])

    return { data, loading, failed, reload }
}

/**
 * Un `Input type="number"` controlado por un número no deja escribir «-74»: al
 * teclear «-» el valor parseado es 0 y React reescribe el campo con «0». Se
 * conserva lo tecleado mientras diga lo mismo que el valor del formulario; si
 * el valor cambia por fuera (soltar el pin), manda el valor. Lo que se escribe
 * en el formulario no cambia: `parseFloat(texto) || 0`.
 */
function CoordinateInput({
    value,
    onChange,
    ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "step"> & {
    value: unknown
    onChange: (next: number) => void
}) {
    const [draft, setDraft] = useState<string | null>(null)
    const current = parseFloat(String(value ?? "")) || 0
    const shown = draft !== null && (parseFloat(draft) || 0) === current ? draft : String(value ?? "")
    return (
        <Input
            type="number"
            step="any"
            {...props}
            value={shown}
            onChange={(e) => {
                setDraft(e.target.value)
                onChange(parseFloat(e.target.value) || 0)
            }}
        />
    )
}

const loadCountries = () => catalogService.getCountries()
const loadTimezones = () => catalogService.getTimezonesGrouped()


/** Cinco decimales (~1 m): lo que se lee del dato; el valor guardado no se redondea. */
const formatCoordinate = (value: unknown): string | null => {
    const n = Number(value)
    return Number.isFinite(n) ? n.toFixed(5) : null
}

export function PropertiesLocation() {
    const form = useFormContext()
    const countries = useCatalog<CountryOption[]>(loadCountries, [])
    const timezones = useCatalog<TimezoneGroup[]>(loadTimezones, [])
    const pendingCountryCodeRef = useRef("")
    const [manualCoordinates, setManualCoordinates] = useState(false)
    const coordinatesFieldsId = useId()

    // Los grupos (América, Europa…) se conservan como texto buscable: el
    // Combobox no agrupa, pero «america» sigue encontrando America/Bogota.
    const timezoneOptions = timezones.data.flatMap((tg) =>
        tg.options.map((tz) => ({ value: tz.id, label: tz.name, keywords: tg.group })),
    )
    const countryOptions = countries.data.map((c) => ({
        value: String(c.id),
        label: c.name,
        leading: c.extra?.emoji ? <span aria-hidden>{c.extra.emoji}</span> : undefined,
        keywords: c.extra?.iso2,
    }))

    // Using flat structure from PropertyFormData.
    //
    // Nada de `|| 0`: el esquema declara `.default(0)`, así que "sin ubicación" y
    // "coordenada cero" son el mismo valor, y centrar ahí a zoom de calle dejaba
    // al usuario en mar abierto — un rectángulo azul que parecía un mapa roto.
    // `resolveMapView` decide centro y zoom, y además dice si la ubicación es real.
    const rawLat = form.watch("latitude")
    const rawLng = form.watch("longitude")
    const mapView = resolveMapView(rawLat, rawLng)

    // Un error de coordenada (fuera de rango) tiene que verse aunque el PM no
    // haya abierto la edición a mano: se abre sola mientras dure el error.
    const { errors: coordinateErrors } = useFormState({ control: form.control, name: ["latitude", "longitude"] })
    const coordinatesOpen = manualCoordinates || !!coordinateErrors.latitude || !!coordinateErrors.longitude

    const handleMapChange = useCallback((newLat: number, newLng: number) => {
        form.setValue("latitude", newLat, { shouldValidate: true, shouldDirty: true })
        form.setValue("longitude", newLng, { shouldValidate: true, shouldDirty: true })
    }, [form])

    const countryList = countries.data
    const applyCountry = useCallback((countryCode: string): boolean => {
        const normalizedCountryCode = countryCode.trim().toUpperCase()
        if (!normalizedCountryCode) return false

        const countryMatch = countryList.find(
            (country) => country.extra.iso2?.toUpperCase() === normalizedCountryCode,
        )
        if (!countryMatch) return false

        const nextCountryId = Number(countryMatch.id)
        if (!Number.isInteger(nextCountryId) || nextCountryId <= 0) return false

        const previousCountryId = Number(form.getValues("countryId"))
        form.setValue("countryId", nextCountryId, { shouldDirty: true, shouldValidate: true })

        if (previousCountryId !== nextCountryId) {
            const countryTimezones = countryMatch.extra.timezones ?? []
            // A country-level guess is only safe when exactly one timezone is
            // available. Otherwise clear the stale zone from the prior country
            // and let the PM choose the correct one.
            form.setValue("timezone", countryTimezones.length === 1 ? countryTimezones[0] : "", {
                shouldDirty: true,
                shouldValidate: true,
            })
        }
        return true
    }, [countryList, form])

    // A fast geocode response can beat the country catalog request. Keep the ISO
    // code pending and apply it as soon as the catalog becomes available.
    useEffect(() => {
        if (!pendingCountryCodeRef.current) return
        if (applyCountry(pendingCountryCodeRef.current)) pendingCountryCodeRef.current = ""
    }, [applyCountry])

    // Aplica la selección del proveedor geográfico nativo (o Google cuando se
    // habilite): coordenadas + dirección, país y zona horaria.
    const handlePlaceSelect = (d: PlaceDetails) => {
        if (d.lat != null && d.lng != null) {
            form.setValue("latitude", d.lat, { shouldDirty: true, shouldValidate: true })
            form.setValue("longitude", d.lng, { shouldDirty: true, shouldValidate: true })
        }
        if (d.addressLine1 || d.formattedAddress) {
            form.setValue("address", d.addressLine1 || d.formattedAddress, { shouldDirty: true, shouldValidate: true })
        }
        // Empty provider components must also overwrite old values. Otherwise,
        // changing from an apartment to a house keeps the former unit/city/state.
        form.setValue("addressDetail", d.addressLine2, { shouldDirty: true, shouldValidate: true })
        form.setValue("city", d.city, { shouldDirty: true, shouldValidate: true })
        form.setValue("state", d.state, { shouldDirty: true, shouldValidate: true })

        if (d.countryCode) {
            pendingCountryCodeRef.current = d.countryCode
            if (applyCountry(d.countryCode)) pendingCountryCodeRef.current = ""
        }

        toast.success("Ubicación seleccionada", {
            description: d.city || d.formattedAddress || "Dirección aplicada al mapa.",
        })
    }

    return (
        <SectionCard
            title="Ubicación"
            description="Busca la dirección o arrastra el pin. Sin ubicación no se calculan distancias ni se muestra en el mapa."
            headingLevel={2}
        >
            <div className="space-y-6">
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Dirección <RequiredMark /></FormLabel>
                            <FormControl>
                                <AddressAutocomplete
                                    value={field.value ?? ""}
                                    onChange={(nextAddress) => {
                                        if (nextAddress !== field.value) {
                                            // Text edits invalidate the previous geocode. A
                                            // subsequent suggestion selection restores exact
                                            // coordinates through handlePlaceSelect.
                                            form.setValue("latitude", 0, { shouldDirty: true })
                                            form.setValue("longitude", 0, { shouldDirty: true })
                                        }
                                        field.onChange(nextAddress)
                                    }}
                                    onSelect={handlePlaceSelect}
                                    placeholder="Escribe y elige de las sugerencias (ej. Pullman Hotel Miami)…"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="addressDetail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Dirección, línea 2 · opcional</FormLabel>
                                <FormControl>
                                    <Input placeholder="Apto, suite, torre…" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Departamento o estado <RequiredMark /></FormLabel>
                                <FormControl>
                                    <Input placeholder="Bolívar" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ciudad <RequiredMark /></FormLabel>
                                <FormControl>
                                    <Input placeholder="Cartagena" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="countryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>País <RequiredMark /></FormLabel>
                                <FormControl>
                                    <Combobox
                                        ref={field.ref}
                                        // El formulario guarda `countryId` como número; el Combobox habla en texto.
                                        value={field.value ? String(field.value) : null}
                                        onValueChange={(value) => {
                                            if (value != null) field.onChange(Number(value))
                                        }}
                                        options={countryOptions}
                                        placeholder="Busca un país"
                                        searchPlaceholder="Buscar país…"
                                        emptyText="No hay países con ese nombre"
                                        loading={countries.loading}
                                    />
                                </FormControl>
                                {countries.failed && (
                                    <CatalogError
                                        what="los países"
                                        consequence="El país es obligatorio."
                                        retrying={countries.loading}
                                        onRetry={() => void countries.reload()}
                                    />
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Zona horaria</FormLabel>
                                <FormControl>
                                    <Combobox
                                        ref={field.ref}
                                        value={field.value || null}
                                        onValueChange={(value) => field.onChange(value ?? "")}
                                        options={timezoneOptions}
                                        placeholder="Busca una zona horaria"
                                        searchPlaceholder="Buscar zona horaria…"
                                        emptyText="No hay zonas horarias con ese nombre"
                                        loading={timezones.loading}
                                    />
                                </FormControl>
                                {timezones.failed && (
                                    <CatalogError
                                        what="las zonas horarias"
                                        retrying={timezones.loading}
                                        onRetry={() => void timezones.reload()}
                                    />
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* MapField: aviso + mapa + coordenadas, en una sola composición. */}
                <div className="space-y-3">
                    {/*
                      * Sin coordenadas el formulario igual se guarda —el esquema las
                      * rellena con 0— y la propiedad queda registrada en mar abierto.
                      * Antes eso no se avisaba en ninguna parte: el único indicio era
                      * un mapa azul que parecía estar cargando.
                      */}
                    {!mapView.hasCoordinates && (
                        <FeedbackBanner tone="warning" density="compact" title="Esta propiedad todavía no tiene ubicación en el mapa.">
                            Elige una sugerencia en la dirección, o arrastra el pin hasta el punto exacto.
                            Sin esto no podremos mostrar la propiedad ni calcular distancias.
                        </FeedbackBanner>
                    )}

                    <Surface flat className="overflow-hidden">
                        <div className="h-72 w-full lg:h-90">
                            <MapComponent
                                lat={mapView.lat}
                                lng={mapView.lng}
                                zoom={mapView.zoom}
                                onChange={handleMapChange}
                            />
                        </div>
                    </Surface>

                    <Surface tone="sunk" flat className="px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            {coordinatesOpen ? (
                                <div id={coordinatesFieldsId} className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="latitude"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Latitud</FormLabel>
                                                <FormControl>
                                                    <CoordinateInput {...field} value={field.value} onChange={field.onChange} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="longitude"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Longitud</FormLabel>
                                                <FormControl>
                                                    <CoordinateInput {...field} value={field.value} onChange={field.onChange} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ) : (
                                <dl className="grid flex-1 grid-cols-2 gap-4 tabular-nums">
                                    <DefinitionItem label="Latitud">
                                        {mapView.hasCoordinates ? formatCoordinate(rawLat) : "—"}
                                    </DefinitionItem>
                                    <DefinitionItem label="Longitud">
                                        {mapView.hasCoordinates ? formatCoordinate(rawLng) : "—"}
                                    </DefinitionItem>
                                </dl>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-expanded={coordinatesOpen}
                                aria-controls={coordinatesOpen ? coordinatesFieldsId : undefined}
                                // Con un error de coordenadas el panel queda abierto a la fuerza:
                                // el botón no puede cerrarlo, así que no finge que sí.
                                disabled={coordinatesOpen && !manualCoordinates}
                                onClick={() => setManualCoordinates((open) => !open)}
                            >
                                {coordinatesOpen ? "Ocultar coordenadas" : "Ajustar a mano"}
                            </Button>
                        </div>
                    </Surface>
                </div>
            </div>
        </SectionCard>
    )
}
