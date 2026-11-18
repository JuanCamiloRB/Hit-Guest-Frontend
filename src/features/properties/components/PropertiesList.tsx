"use client"

import { useState, useMemo, useCallback } from "react"
import { Property, Unit } from "@/types"
import { PropertyCard } from "./PropertyCard"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter, Home, List, X } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { LoadingState, RefreshIndicator } from "@/components/ui/loading-state"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { TextLink } from "@/components/ui/text-link"
import { formatMoney } from "@/lib/money"
import { propertyEditHref } from "../lib/property-tabs"
import { useCachedLoad } from "@/hooks/useCachedLoad"
import { portfolioCache, propertiesCache } from "../lib/properties-cache"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { PageHeader } from "@/components/ui/page"
import { Surface } from "@/components/ui/card"

/** Una fila de la tabla de alojamientos: el alojamiento con su propiedad ya resuelta. */
interface ListingRow {
    unit: Unit
    propertyName: string
    /** A dónde lleva la fila: la pestaña Alojamientos de su propiedad (y ese alojamiento). */
    href: string | null
}

export const LISTINGS_PAGE_SIZE = 10
const LISTINGS_LABEL = { singular: "alojamiento", plural: "alojamientos" }

const STATUS_LABEL: Record<Unit["status"], string> = { ACTIVE: "Activo", INACTIVE: "Inactivo" }

/** «—» en `ink-4` es «no aplica» (manual §3): sin precio o sin capacidad declarada. */
function Absent() {
    return <span className="text-ink-4">—</span>
}

function capacityText(capacity: number | null): string | null {
    if (capacity === null) return null
    return `${capacity} ${capacity === 1 ? "huésped" : "huéspedes"}`
}

/**
 * Orden por nombre, propiedad, estado, capacidad y precio. Un dato ausente es
 * `undefined` para TanStack y `sortUndefined: "last"` lo deja al final en los
 * DOS sentidos (con -1 subía primero al ordenar ascendente).
 */
const LISTING_COLUMNS: ColumnDef<ListingRow>[] = [
    {
        id: "name",
        accessorFn: (row) => row.unit.name,
        header: "Alojamiento",
        cell: ({ row }) => {
            const { unit, href } = row.original
            const name = unit.name || "Sin nombre"
            return (
                <div className="flex min-w-0 flex-col">
                    {/* El enlace REAL (teclado, lector) es el nombre; la fila entera lo acompaña. */}
                    {href ? <TextLink href={href} className="truncate">{name}</TextLink> : <span className="font-medium text-ink">{name}</span>}
                    {unit.number && <span className="text-xs text-ink-3">{unit.number}</span>}
                </div>
            )
        },
    },
    {
        id: "property",
        accessorFn: (row) => row.propertyName,
        header: "Propiedad",
        cell: ({ row }) => <span className="text-ink-2">{row.original.propertyName}</span>,
    },
    {
        id: "status",
        accessorFn: (row) => STATUS_LABEL[row.unit.status],
        header: "Estado",
        cell: ({ row }) => (
            <StatusPill tone={row.original.unit.status === "ACTIVE" ? "success" : "idle"}>
                {STATUS_LABEL[row.original.unit.status]}
            </StatusPill>
        ),
    },
    {
        id: "capacity",
        accessorFn: (row) => row.unit.capacity ?? undefined,
        sortUndefined: "last",
        // Como las columnas de texto: el primer clic ordena de menor a mayor.
        sortDescFirst: false,
        header: "Capacidad",
        cell: ({ row }) => capacityText(row.original.unit.capacity) ?? <Absent />,
    },
    {
        id: "price",
        accessorFn: (row) => row.unit.pricePerNight ?? undefined,
        sortUndefined: "last",
        sortDescFirst: false,
        header: () => <span className="block text-right">Precio por noche</span>,
        cell: ({ row }) => {
            const { pricePerNight, currency } = row.original.unit
            return (
                <span className="block text-right font-semibold tabular-nums text-ink">
                    {pricePerNight === null ? <Absent /> : formatMoney(pricePerNight, currency)}
                </span>
            )
        },
    },
]

/** La fila apilada en móvil: nombre + estado, metadatos, capacidad y precio. */
function ListingMobileRow({ row }: { row: ListingRow }) {
    const { unit, href, propertyName } = row
    const name = unit.name || "Sin nombre"
    return (
        <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
                {href ? <TextLink href={href}>{name}</TextLink> : <span className="font-medium text-ink">{name}</span>}
                <StatusPill tone={unit.status === "ACTIVE" ? "success" : "idle"}>{STATUS_LABEL[unit.status]}</StatusPill>
            </div>
            {unit.number && <p className="text-xs text-ink-3">{unit.number}</p>}
            <p className="text-sm text-ink-2">{propertyName}</p>
            <div className="flex items-center justify-between gap-3 pt-1 text-sm">
                <span className="text-ink-2">{capacityText(unit.capacity) ?? <Absent />}</span>
                <span className="font-semibold tabular-nums text-ink">{unit.pricePerNight === null ? <Absent /> : formatMoney(unit.pricePerNight, unit.currency)}</span>
            </div>
        </div>
    )
}

const rowId = (row: ListingRow) => String(row.unit.id)
const rowHref = (row: ListingRow) => row.href ?? ""
const renderMobileRow = (row: ListingRow) => <ListingMobileRow row={row} />

// ── Component ──────────────────────────────────────────────────────────

export function PropertiesList() {
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [propertyFilter, setPropertyFilter] = useState<string>("ALL")
    const [activeTab, setActiveTab] = useState("properties")

    // Dos cargas, las dos detrás de caché (volver muestra lo último mientras se
    // refresca): las propiedades solas pintan las tarjetas enseguida; el
    // portafolio agregado (más lento) trae alojamientos, conteos e insignias.
    const light = useCachedLoad(propertiesCache)
    const portfolio = useCachedLoad(portfolioCache)
    const refreshLight = light.refresh
    const refreshPortfolio = portfolio.refresh
    const properties = useMemo(
        () => light.data ?? portfolio.data?.properties ?? [],
        [light.data, portfolio.data],
    )
    const units = useMemo(() => portfolio.data?.listings ?? [], [portfolio.data])
    // `null` = todavía no llegó el agregado: las tarjetas muestran "—", nunca un
    // cero inventado.
    const overviewByProperty = portfolio.data?.overview ?? null
    const hasProperties = light.data !== null || portfolio.data !== null
    const isLoading = !hasProperties && (light.status === "loading" || portfolio.status === "loading")
    // Sin nada cargado y las dos cargas caídas: se dice, no «no hay propiedades».
    const propertiesFailed = !hasProperties && light.status === "error" && portfolio.status === "error"
    const isLoadingListings = portfolio.status === "loading"
    const listingsFailed = portfolio.status === "error"
    const retryAll = useCallback(() => {
        refreshLight()
        refreshPortfolio()
    }, [refreshLight, refreshPortfolio])

    // Activar o desactivar una propiedad también cambia sus alojamientos en el
    // backend (contrato 2026-10-27: apaga los activos y, al reactivarla, vuelven
    // esos mismos). La tarjeta cambia en el acto y el portafolio se relee
    // detrás, conservando lo que se ve.
    const handlePropertyStatusChange = useCallback((uuid: string, status: "ACTIVE" | "INACTIVE") => {
        const apply = (list: Property[]) => list.map((property) => property.uuid === uuid ? { ...property, status } : property)
        propertiesCache.patch(apply)
        portfolioCache.patch((current) => ({ ...current, properties: apply(current.properties) }))
        refreshPortfolio()
    }, [refreshPortfolio])

    const clearFilters = useCallback(() => {
        setSearchQuery("")
        setStatusFilter("ALL")
        setPropertyFilter("ALL")
    }, [])

    const filteredProperties = useMemo(() => {
        return properties.filter((property: Property) => {
            const matchesSearch =
                property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (property.address?.line1 || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (property.address?.city || "").toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus = statusFilter === "ALL" || property.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [properties, searchQuery, statusFilter])

    const propertyById = useMemo(() => new Map(properties.map((p: Property) => [String(p.id), p])), [properties])
    const listingRows = useMemo<ListingRow[]>(() => units.map((unit: Unit) => {
        const property = propertyById.get(String(unit.propertyId))
        const propertyUuid = property?.uuid ?? property?.id
        return {
            unit,
            propertyName: property?.name ?? "",
            // `?unit=` abre ese alojamiento en la pestaña (PropertiesUnits lo lee).
            href: propertyUuid ? `${propertyEditHref(propertyUuid, "units")}${unit.uuid ? `&unit=${encodeURIComponent(unit.uuid)}` : ""}` : null,
        }
    }), [units, propertyById])

    const filteredRows = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase()
        return listingRows.filter(({ unit, propertyName }) => {
            const matchesSearch = needle === ""
                || unit.name?.toLowerCase().includes(needle)
                || (unit.number || "").toLowerCase().includes(needle)
                || propertyName.toLowerCase().includes(needle)
            const matchesStatus = statusFilter === "ALL" || unit.status === statusFilter
            const matchesProperty = propertyFilter === "ALL" || String(unit.propertyId) === propertyFilter
            return matchesSearch && matchesStatus && matchesProperty
        })
    }, [listingRows, searchQuery, statusFilter, propertyFilter])

    const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "ALL" || (activeTab === "units" && propertyFilter !== "ALL")

    return (
        <div className="space-y-6">
            <PageHeader
                title="Propiedades y Alojamientos"
                // Lo cargado sigue a la vista mientras se relee (p. ej. tras activar una propiedad).
                titleAddon={
                    <RefreshIndicator
                        active={hasProperties && (light.status === "refreshing" || portfolio.status === "refreshing")}
                        label="Actualizando propiedades…"
                    />
                }
                description={properties.length > 0
                    ? `${properties.length} ${properties.length === 1 ? "propiedad" : "propiedades"}${overviewByProperty
                        ? ` · ${Object.values(overviewByProperty).reduce((sum, o) => sum + o.activeListings, 0)} alojamientos activos`
                        : ""}`
                    : "Gestiona tus propiedades, unidades y configuraciones de automatización."}
                actions={
                    <Button asChild size="lg">
                        <Link href="/dashboard/properties/new">
                            <Icon icon={Plus} className="mr-2" /> Añadir Propiedad
                        </Link>
                    </Button>
                }
            />

            <Tabs defaultValue="properties" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <Surface className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2">
                    {/* Pestañas estándar (las de Operaciones): la pantalla solo pone el layout. */}
                    <TabsList className="grid grid-cols-2 w-full md:w-100">
                        <TabsTrigger value="properties">
                            <Icon icon={Home} /> Propiedades
                        </TabsTrigger>
                        <TabsTrigger value="units">
                            <Icon icon={List} /> Alojamientos
                        </TabsTrigger>
                    </TabsList>

                    {/* Solo los filtros de la pestaña activa; «Limpiar» solo cuando hay alguno. */}
                    <div className="flex flex-1 flex-wrap items-center gap-3 px-2">
                        <div className="relative flex-1 max-w-sm">
                            <Icon icon={Search} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                            <Input
                                placeholder={activeTab === "units" ? "Buscar por nombre, número o propiedad…" : "Buscar por nombre o ciudad…"}
                                aria-label={activeTab === "units" ? "Buscar alojamientos" : "Buscar propiedades"}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            {/* min-w, no w fijo: con ícono, flecha y «Cualquier estado» no cabía en 180 px y la flecha pisaba el texto. */}
                            <SelectTrigger className="min-w-45 shrink-0 h-10" aria-label="Filtrar por estado">
                                <div className="flex items-center gap-2 pointer-events-none min-w-0">
                                    <Icon icon={Filter} className="text-ink-3" />
                                    <SelectValue placeholder="Estado" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Cualquier estado</SelectItem>
                                <SelectItem value="ACTIVE">Activos</SelectItem>
                                <SelectItem value="INACTIVE">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>
                        {activeTab === "units" && (
                            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                                <SelectTrigger className="min-w-45 shrink-0 h-10" aria-label="Filtrar por propiedad">
                                    <div className="flex items-center gap-2 pointer-events-none min-w-0">
                                        <Icon icon={Home} className="text-ink-3" />
                                        <SelectValue placeholder="Propiedad" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas las propiedades</SelectItem>
                                    {properties.map((p: Property) => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {hasActiveFilters && (
                            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} aria-label="Limpiar filtros aplicados">
                                <Icon icon={X} /> Limpiar
                            </Button>
                        )}
                    </div>
                </Surface>

                <TabsContent value="properties" className="space-y-6 outline-none">
                    {isLoading ? (
                        // Esqueleto con la forma de la grilla de tarjetas: nada salta al llegar.
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            <span className="sr-only" role="status">Cargando propiedades…</span>
                            {Array.from({ length: 4 }, (_, i) => (
                                <Skeleton key={i} aria-hidden className="h-72 rounded-xl" />
                            ))}
                        </div>
                    ) : propertiesFailed ? (
                        // Un error de carga no es un vacío (escala de la 2.2).
                        <FeedbackBanner
                            tone="danger"
                            mode="blocking"
                            title="No pudimos cargar tus propiedades"
                            action={<Button variant="outline" size="sm" onClick={retryAll}>Reintentar</Button>}
                        >
                            Revisa tu conexión e intenta de nuevo.
                        </FeedbackBanner>
                    ) : filteredProperties.length === 0 ? (
                        <Surface dashed>
                            {properties.length === 0 ? (
                                <EmptyState
                                    icon={Home}
                                    title="Todavía no tienes propiedades"
                                    description="Añade tu primera propiedad para empezar a recibir check-ins."
                                    action={
                                        <Button asChild size="sm">
                                            <Link href="/dashboard/properties/new"><Icon icon={Plus} /> Añadir propiedad</Link>
                                        </Button>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    kind="no-results"
                                    icon={Home}
                                    title={searchQuery.trim() ? `Sin resultados para «${searchQuery.trim()}»` : "Ninguna propiedad coincide con los filtros"}
                                    description="Prueba con otra búsqueda o quita el filtro de estado."
                                    action={<Button variant="outline" size="sm" onClick={clearFilters}>Limpiar filtros</Button>}
                                />
                            )}
                        </Surface>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProperties.map((property: Property) => (
                                <PropertyCard
                                    // El interruptor de la tarjeta se siembra al montar: si el
                                    // estado llega distinto en un refresco, se vuelve a montar.
                                    key={`${property.id}-${property.status}`}
                                    property={property}
                                    activeListings={overviewByProperty?.[property.uuid ?? ""]?.activeListings ?? null}
                                    badges={overviewByProperty?.[property.uuid ?? ""]?.badges ?? null}
                                    onStatusChange={handlePropertyStatusChange}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="units" className="space-y-6 outline-none">
                    {isLoadingListings ? (
                        // Esqueleto con la geometría final: una página de filas.
                        <LoadingState rows={LISTINGS_PAGE_SIZE} label="Cargando alojamientos" />
                    ) : listingsFailed ? (
                        <FeedbackBanner
                            tone="danger"
                            mode="blocking"
                            title="No pudimos cargar los alojamientos"
                            action={<Button variant="outline" size="sm" onClick={refreshPortfolio}>Reintentar</Button>}
                        >
                            Revisa tu conexión e intenta de nuevo.
                        </FeedbackBanner>
                    ) : (
                        <div className="space-y-3">
                            {/* El conteo se anuncia sin interrumpir: «8 de 28 alojamientos» al filtrar. */}
                            <p role="status" className="text-sm text-ink-3">
                                {hasActiveFilters
                                    ? `${filteredRows.length} de ${units.length} ${units.length === 1 ? "alojamiento" : "alojamientos"}`
                                    : `${units.length} ${units.length === 1 ? "alojamiento" : "alojamientos"}`}
                            </p>
                            <DataTable
                                columns={LISTING_COLUMNS}
                                data={filteredRows}
                                getRowId={rowId}
                                getRowHref={rowHref}
                                renderMobileRow={renderMobileRow}
                                pageSize={LISTINGS_PAGE_SIZE}
                                itemLabel={LISTINGS_LABEL}
                                defaultSorting={[{ id: "name", desc: false }]}
                                empty={units.length === 0 ? (
                                    <EmptyState
                                        title="Todavía no hay alojamientos"
                                        description="Los alojamientos se crean dentro de cada propiedad."
                                    />
                                ) : (
                                    <EmptyState
                                        kind="no-results"
                                        title={searchQuery.trim() ? `Sin resultados para «${searchQuery.trim()}»` : "Ningún alojamiento coincide con los filtros"}
                                        description="Prueba con otra búsqueda o quita algún filtro."
                                        action={<Button variant="outline" size="sm" onClick={clearFilters}>Limpiar filtros</Button>}
                                    />
                                )}
                            />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
