"use client"

import { useState, useMemo, useCallback } from "react"
import { Property, Unit } from "@/types"
import { PropertyCard } from "./PropertyCard"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter, Home, List } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { SectionCard } from "@/components/ui/section-card"
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useCachedLoad } from "@/hooks/useCachedLoad"
import { portfolioCache, propertiesCache } from "../lib/properties-cache"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { PageHeader } from "@/components/ui/page"
import { Surface } from "@/components/ui/card"

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

    const filteredUnits = useMemo(() => {
        return units.filter((unit: Unit) => {
            const matchesSearch =
                unit.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (unit.number || "").toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus = statusFilter === "ALL" || unit.status === statusFilter
            const matchesProperty = propertyFilter === "ALL" || unit.propertyId === propertyFilter
            return matchesSearch && matchesStatus && matchesProperty
        })
    }, [units, searchQuery, statusFilter, propertyFilter])

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

                    <div className="flex flex-1 items-center gap-3 px-2">
                        <div className="relative flex-1 max-w-sm">
                            <Icon icon={Search} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                            <Input
                                placeholder="Buscar por nombre o número..."
                                aria-label="Buscar propiedades y alojamientos"
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
                        <div className="rounded-xl border-2 border-dashed border-rule bg-card">
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
                        </div>
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
                        <SectionCard flush title="Listado de Alojamientos">
                            <LoadingState rows={5} label="Cargando alojamientos" />
                        </SectionCard>
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
                        <SectionCard
                            flush
                            title="Listado de Alojamientos"
                            actions={
                                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                                    <SelectTrigger className="w-50 h-9 text-xs" aria-label="Filtrar por propiedad">
                                        <SelectValue placeholder="Propiedad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todas las Propiedades</SelectItem>
                                        {properties.map((p: Property) => (
                                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            }
                        >
                            <Table>
                                {/* Lenguaje de tabla compartido (Fase 3): el encabezado lo pone
                                    la primitiva; antes iba en 10 px, mayúsculas y navy. */}
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-25">Número</TableHead>
                                        <TableHead>Nombre del alojamiento</TableHead>
                                        <TableHead>Propiedad</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Capacidad</TableHead>
                                        <TableHead className="text-right">Precio</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUnits.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="p-0 whitespace-normal">
                                                {units.length === 0 ? (
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
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUnits.map((unit: Unit) => {
                                            const property = properties.find((p: Property) => p.id === unit.propertyId)
                                            return (
                                                <TableRow key={unit.id}>
                                                    <TableCell className="font-bold text-primary">{unit.number}</TableCell>
                                                    <TableCell className="font-bold text-ink">{unit.name}</TableCell>
                                                    <TableCell className="text-ink-2 text-sm font-medium">{property?.name}</TableCell>
                                                    <TableCell>
                                                        <StatusPill tone={unit.status === "ACTIVE" ? "success" : "idle"}>{unit.status === "ACTIVE" ? "Activo" : "Inactivo"}</StatusPill>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium text-ink-2">{unit.capacity} Huéspedes</TableCell>
                                                    <TableCell className="text-right font-bold text-ink">
                                                        ${unit.pricePerNight?.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </SectionCard>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
