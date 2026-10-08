"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useFormContext } from "react-hook-form"
import { Sparkles, Loader2, AlertCircle } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { automationService, canonicalSlug } from "../services/automation-service"
import { listingsService } from "../services/listings-service"
import { reservationSourceService, type ReservationSource } from "../services/reservation-source-service"
import { bindCatalogProviders, buildAutomationSlots, isAutomationProvider } from "../lib/automation-catalog"
import { DELIVERY_PROVIDERS, partitionCheckinLinkDelivery } from "../lib/checkin-link-delivery"
import { catalogService } from "@/features/auth/services/catalog-service"
import type { PropertyAutomation, Provider } from "../types/automation"
import { AutomationCard, CheckinLinkDeliveryCard, type ListingMeta } from "./automations"

interface CountryCatalogItem {
    id: string | number
    iso2?: string
    extra?: { iso2?: string }
}

interface PropertyListingRow {
    uuid: string
    name?: string | null
    internalName?: string | null
    internal_name?: string | null
}

interface Props {
    /** Jumps the parent Tabs to "documents" — where contract text + signature routing now lives. */
    onNavigateToDocuments?: () => void
}

export function PropertiesAutomation({ onNavigateToDocuments }: Props) {
    const { watch } = useFormContext()
    const propertyUuid: string = watch("uuid") ?? ""
    const countryId: number | undefined = watch("countryId")
    // Pista del canal OTA (§13.3): el backend manda `pmsIdentifiers` y el
    // formulario lo guarda como `externalPmsIds`. Es una PISTA — la integración
    // puede estar inactiva; el 422 de `configure` es la fuente de verdad.
    const externalPmsIds: unknown = watch("externalPmsIds")
    const pmsConnected = Array.isArray(externalPmsIds) && externalPmsIds.length > 0

    const [automations, setAutomations] = useState<PropertyAutomation[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [countryProviderSlugs, setCountryProviderSlugs] = useState<string[]>([])
    const [listings, setListings] = useState<ListingMeta[]>([])
    const [sources, setSources] = useState<ReservationSource[]>([])
    /**
     * Providers del envío del link, resueltos aparte por slug: pueden llegar sin
     * `applicable_countries` y quedar fuera de `GET /providers?country=` (la
     * misma trampa de didit/textract). WhatsApp es el de la fila (sin él no se
     * puede crear); OTA solo aporta su tarifa (§13.2). `null` = no disponible.
     */
    const [deliveryProviders, setDeliveryProviders] = useState<{
        whatsapp: Provider | null
        ota_inbox: Provider | null
    }>({ whatsapp: null, ota_inbox: null })
    const [completedRequestKey, setCompletedRequestKey] = useState("")
    const [loadFailure, setLoadFailure] = useState<{ key: string; message: string } | null>(null)
    const requestKey = `${propertyUuid}:${countryId ?? ""}`
    const loading = !!propertyUuid && completedRequestKey !== requestKey
    const loadError = loadFailure?.key === requestKey ? loadFailure.message : null

    // The backend creates a country-specific automation map. Load exactly that
    // map (with providers sideloaded) and filter the provider catalog by the
    // property's ISO2 — never render the old universal 1..8 template.
    useEffect(() => {
        if (!propertyUuid) return
        let active = true

        const load = async () => {
            const countries = await catalogService.getCountries() as CountryCatalogItem[]
            const country = countries.find(item => Number(item.id) === Number(countryId))
            const countryIso2 = country?.extra?.iso2 ?? country?.iso2
            if (!countryIso2) {
                throw new Error("No se pudo resolver el país de la propiedad.")
            }

            const [automationRows, providerRows, listingRows, sourceRows] = await Promise.all([
                automationService.list(propertyUuid, { includeProvider: true }),
                automationService.listProviders({ statusProviderId: 8, country: countryIso2 }),
                listingsService.listByProperty(propertyUuid),
                // Solo para traducir las claves de `by_source` a nombres en la
                // tarjeta de Contrato. Cosmético a propósito: si falla, la tarjeta
                // muestra el id crudo del canal — nunca se bloquea la pestaña ni
                // se oculta el routing por no tener el catálogo.
                reservationSourceService.list().catch(() => [] as ReservationSource[]),
            ])

            if (!active) return
            setLoadFailure(null)
            setAutomations([...automationRows].sort((a, b) => a.executionOrder - b.executionOrder))
            // Preserve a currently configured provider even if it was deactivated
            // after configuration; otherwise its selector would appear blank.
            const providerMap = new Map(providerRows.map((provider) => [provider.id, provider]))
            for (const automation of automationRows) {
                if (automation.provider) providerMap.set(automation.provider.id, automation.provider)
            }
            const allProviders = Array.from(providerMap.values())
            // Conectores (sin slug) y providers que el backend declara «no
            // automatización» (`automationType: null`) no llegan a ningún
            // selector ni tarjeta genérica — ver `isAutomationProvider`.
            const automationProviders = allProviders.filter(isAutomationProvider)
            // Los del envío del link se resuelven sobre la lista COMPLETA (el de
            // OTA no es automatización) y, si no están, por `name[has]`. Un fallo
            // acá es cosmético: la tarjeta dice que el canal no está disponible.
            const [whatsapp, otaInbox] = await Promise.all(
                (["whatsapp", "ota_inbox"] as const).map((channel) =>
                    automationService
                        .findProviderBySlug(DELIVERY_PROVIDERS[channel].slug, DELIVERY_PROVIDERS[channel].nameHint, allProviders)
                        .catch(() => null),
                ),
            )
            if (!active) return
            setProviders(automationProviders)
            setDeliveryProviders({ whatsapp, ota_inbox: otaInbox })
            setCountryProviderSlugs(providerRows.flatMap((provider) =>
                provider.parameters?.slug ? [canonicalSlug(provider.parameters.slug)] : [],
            ))
            setListings(
                (listingRows as PropertyListingRow[]).map(l => ({
                    uuid: l.uuid,
                    name: l.name ?? "Unidad sin nombre",
                    internalName: l.internalName ?? l.internal_name ?? null,
                }))
            )
            setSources(sourceRows)
        }

        load()
            .catch((error) => {
                console.error("[PropertiesAutomation] load error:", error)
                if (active) {
                    setAutomations([])
                    setProviders([])
                    setCountryProviderSlugs([])
                    setListings([])
                    setSources([])
                    setDeliveryProviders({ whatsapp: null, ota_inbox: null })
                    setLoadFailure({
                        key: requestKey,
                        message: error instanceof Error ? error.message : "No se pudieron cargar las automatizaciones.",
                    })
                }
            })
            .finally(() => { if (active) setCompletedRequestKey(requestKey) })

        return () => { active = false }
    }, [propertyUuid, countryId, requestKey])

    const handleChanged = useCallback((updated: PropertyAutomation | null, automationUuid: string | null) => {
        setAutomations(prev => {
            // Fila recién creada: no había uuid previo al que apuntar.
            if (!automationUuid) {
                return updated
                    ? [...prev, updated].sort((a, b) => a.executionOrder - b.executionOrder)
                    : prev
            }
            if (!updated) return prev.filter(a => a.uuid !== automationUuid)
            const previous = prev.find(a => a.uuid === automationUuid)
            const merged = previous ? {
                ...updated,
                // Some configure responses omit sideloaded provider data. Keep it
                // until the next full refresh so semantic routing remains stable.
                provider: updated.provider ?? previous.provider,
                providerName: updated.providerName ?? previous.providerName,
            } : updated
            const exists = previous != null
            return exists
                ? prev.map(a => a.uuid === automationUuid ? merged : a)
                : [...prev, merged].sort((a, b) => a.executionOrder - b.executionOrder)
        })
    }, [])

    /**
     * Lo que se renderiza NO es la lista cruda del backend.
     *
     * `GET /properties/{uuid}/automations` solo devuelve las filas que existen.
     * El alta neutral omite `automations`: el backend crea los dos slots
     * estructurales de identidad, mientras TTLock, PDF, TRA y SIRE no tienen fila
     * y por eso no había tarjeta; sin tarjeta, tampoco había forma de crearlas.
     *
     * `buildAutomationSlots` cruza esas filas con los `default_setup.slots` que
     * publican los providers de `GET /providers?country=`: quien ya tiene fila se
     * comporta igual que siempre, y quien no la tiene aparece como tarjeta
     * disponible. El PM crea la fila inactiva desde la tarjeta y luego la activa
     * mediante `/configure`, después de completar credenciales y disparadores.
     * Nombre, orden y campos salen del backend, no de una lista fija acá.
     */
    // El envío del link tiene tarjeta propia (canales, sin disparadores ni
    // credenciales): se separa ANTES del catálogo genérico para no pintarlo dos
    // veces. La fila del backend nunca se oculta — la muestra esa tarjeta.
    const delivery = useMemo(
        () => partitionCheckinLinkDelivery(automations, providers),
        [automations, providers],
    )
    const slots = useMemo(
        () => buildAutomationSlots(delivery.rest.automations, delivery.rest.providers),
        [delivery],
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-[var(--color-brand-purple)]/10 rounded-lg">
                            <Sparkles className="h-5 w-5 text-[var(--color-brand-purple)]" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
                            Reglas de Automatización
                        </CardTitle>
                    </div>
                    <CardDescription className="text-base text-slate-500">
                        Configura disparadores automáticos para mejorar la experiencia del huésped y agilizar tu operación.
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Guard: property not saved yet */}
            {!propertyUuid && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <AlertCircle size={18} className="text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">
                        Guarda la propiedad primero para poder gestionar las automatizaciones.
                    </p>
                </div>
            )}

            {/* Automation cards grid */}
            {loadError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <AlertCircle size={18} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{loadError}</p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-sm">Cargando automatizaciones...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {/* Primera a propósito: es el primer paso del flujo del huésped
                        (recibe el link → se identifica → firma → reportes). */}
                    {propertyUuid && !loadError && (
                        <CheckinLinkDeliveryCard
                            propertyUuid={propertyUuid}
                            automation={delivery.automation}
                            providers={deliveryProviders}
                            pmsConnected={pmsConnected}
                            existingAutomations={automations}
                            listings={listings}
                            onChanged={(updated) => handleChanged(updated, delivery.automation?.uuid ?? null)}
                        />
                    )}
                    {slots.map(({ key, definition: def, automation }) => {
                        const catalogDefinition = bindCatalogProviders(
                            def,
                            automation,
                            providers,
                            countryProviderSlugs,
                        )
                        return (
                            <AutomationCard
                                key={key}
                                definition={catalogDefinition}
                                automation={automation}
                                propertyUuid={propertyUuid}
                                providers={providers}
                                listings={listings}
                                onChanged={updated => handleChanged(updated, automation?.uuid ?? null)}
                                onNavigateToDocuments={onNavigateToDocuments}
                                sources={sources}
                            />
                        )
                    })}
                    {/* La tarjeta del link se muestra siempre (email es el default sin
                        fila), así que este vacío habla de las DEMÁS automatizaciones. */}
                    {!loadError && propertyUuid && slots.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                            {countryProviderSlugs.length === 0
                                ? "No se pudo determinar qué otras automatizaciones aplican al país de esta propiedad."
                                : "No hay otras automatizaciones disponibles para el país de esta propiedad."}
                        </div>
                    )}
                </div>
            )}

            {/* Custom automation CTA */}
            <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
                <CardContent className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Sparkles className="h-6 w-6 text-[var(--color-brand-purple)]" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">¿Necesitas una regla personalizada?</h4>
                        <p className="text-sm text-slate-500">
                            Contacta con nuestro equipo para crear flujos de trabajo a la medida de tu negocio.
                        </p>
                    </div>
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-2 font-bold flex items-center gap-2"
                    >
                        <a href={`mailto:soporte@hitguest.com?subject=${encodeURIComponent("Solicitud de automatización personalizada")}&body=${encodeURIComponent("Hola equipo HiTGuest,\n\nMe gustaría solicitar una automatización personalizada para mi propiedad.\n\nDescripción de lo que necesito:\n")}`}>
                            Solicitar Automatización personalizada
                        </a>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
