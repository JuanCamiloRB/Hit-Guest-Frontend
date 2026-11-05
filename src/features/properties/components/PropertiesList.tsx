"use client"

import { useState, useMemo, useCallback } from "react"
import { Property, Unit } from "@/types"
import { PropertyCard } from "./PropertyCard"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter, Home, List, Loader2 } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { SectionCard } from "@/components/ui/section-card"
import { LoadingState } from "@/components/ui/loading-state"
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-brand-navy)] drop-shadow-sm">Propiedades y Alojamientos</h2>
                    <p className="text-[var(--color-brand-navy)]/60 text-sm font-medium">
                        {properties.length > 0
                            ? `${properties.length} ${properties.length === 1 ? "propiedad" : "propiedades"}${overviewByProperty
                                ? ` · ${Object.values(overviewByProperty).reduce((sum, o) => sum + o.activeListings, 0)} alojamientos activos`
                                : ""}`
                            : "Gestiona tus propiedades, unidades y configuraciones de automatización."}
                    </p>
                </div>
                <Button asChild className="bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-blue)] hover:opacity-90 text-white shadow-lg shadow-brand-purple/20 border-none px-6 h-11 transition-all duration-300 transform hover:scale-[1.02]">
                    <Link href="/dashboard/properties/new">
                        <Plus className="mr-2 h-5 w-5" /> Añadir Propiedad
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="properties" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border-[1.5px] border-[var(--color-brand-purple)]/20 shadow-xl shadow-brand-purple/5">
                    <TabsList className="grid grid-cols-2 w-full md:w-[400px] bg-slate-100/50 p-1.5 h-12">
                        <TabsTrigger
                            value="properties"
                            className="gap-2 rounded-lg data-[state=active]:bg-[var(--color-brand-navy)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold"
                        >
                            <Home className="h-4 w-4" /> Propiedades
                        </TabsTrigger>
                        <TabsTrigger
                            value="units"
                            className="gap-2 rounded-lg data-[state=active]:bg-[var(--color-brand-navy)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-bold"
                        >
                            <List className="h-4 w-4" /> Alojamientos
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex flex-1 items-center gap-3 px-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-brand-purple)]/50" />
                            <Input
                                placeholder="Buscar por nombre o número..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 border-[var(--color-brand-purple)]/10 bg-white focus:border-[var(--color-brand-purple)] focus:ring-[var(--color-brand-purple)] transition-all"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px] shrink-0 h-10 border-slate-200">
                                <div className="flex items-center gap-2 pointer-events-none min-w-0">
                                    <Filter className="h-3 w-3 shrink-0 text-slate-400" />
                                    <SelectValue placeholder="Estado" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Cualquier Estado</SelectItem>
                                <SelectItem value="ACTIVE">Activos</SelectItem>
                                <SelectItem value="INACTIVE">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <TabsContent value="properties" className="space-y-6 outline-none">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-gradient-to-b from-white to-slate-50 rounded-3xl border-[2px] border-dashed border-[var(--color-brand-purple)]/20">
                            <Loader2 className="h-12 w-12 text-[var(--color-brand-purple)] animate-spin mb-4" />
                            <p className="text-[var(--color-brand-navy)]/60 font-bold tracking-wide">Preparando tus propiedades...</p>
                        </div>
                    ) : propertiesFailed ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                            <EmptyState
                                title="No pudimos cargar tus propiedades"
                                description="Revisa tu conexión e intenta de nuevo."
                                action={<Button variant="outline" size="sm" onClick={retryAll}>Reintentar</Button>}
                            />
                        </div>
                    ) : filteredProperties.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <div className="bg-slate-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Home className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">No se encontraron propiedades</h3>
                            <p className="text-slate-500">Prueba ajustando tus filtros o añade una nueva propiedad.</p>
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
                        <SectionCard flush title="Listado de Alojamientos">
                            <EmptyState
                                title="No pudimos cargar los alojamientos"
                                description="Revisa tu conexión e intenta de nuevo."
                                action={<Button variant="outline" size="sm" onClick={refreshPortfolio}>Reintentar</Button>}
                            />
                        </SectionCard>
                    ) : (
                        <SectionCard
                            flush
                            title="Listado de Alojamientos"
                            actions={
                                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                                    <SelectTrigger className="w-[200px] h-9 text-xs" aria-label="Filtrar por propiedad">
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
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-b-[var(--color-brand-purple)]/10">
                                        <TableHead className="w-[100px] font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">Número</TableHead>
                                        <TableHead className="font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">Nombre Alojamiento</TableHead>
                                        <TableHead className="font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">Propiedad</TableHead>
                                        <TableHead className="font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">Estado</TableHead>
                                        <TableHead className="font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">Capacidad</TableHead>
                                        <TableHead className="text-right font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">Precio</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUnits.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20 text-slate-500">
                                                No se encontraron alojamientos con estos filtros.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUnits.map((unit: Unit) => {
                                            const property = properties.find((p: Property) => p.id === unit.propertyId)
                                            return (
                                                <TableRow key={unit.id} className="hover:bg-[var(--color-brand-purple)]/[0.02] transition-colors border-b-[var(--color-brand-purple)]/5">
                                                    <TableCell className="font-bold text-[var(--color-brand-purple)]">{unit.number}</TableCell>
                                                    <TableCell className="font-bold text-[var(--color-brand-navy)]">{unit.name}</TableCell>
                                                    <TableCell className="text-[var(--color-brand-navy)]/60 text-sm font-medium">{property?.name}</TableCell>
                                                    <TableCell>
                                                        <div className={cn(
                                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                            unit.status === "ACTIVE"
                                                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                                : "bg-slate-100 text-slate-500 border border-slate-200"
                                                        )}>
                                                            {unit.status === "ACTIVE" ? "Activo" : "Inactivo"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium text-[var(--color-brand-navy)]/70">{unit.capacity} Huéspedes</TableCell>
                                                    <TableCell className="text-right font-extrabold text-[var(--color-brand-navy)]">
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
