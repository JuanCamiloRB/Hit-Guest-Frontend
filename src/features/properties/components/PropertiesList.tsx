"use client"

import { useState, useMemo, useEffect } from "react"
import { Property, Unit } from "@/types"
import { PropertyCard } from "./PropertyCard"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter, Home, LayoutGrid, List, Loader2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
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
import { propertiesService } from "../services/properties-service"
import { listingsService } from "../services/listings-service"
import { apiResponseToFormData } from "../types"

export function PropertiesList() {
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [propertyFilter, setPropertyFilter] = useState<string>("ALL")
    const [properties, setProperties] = useState<Property[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const apiProperties = await propertiesService.list()
            
            // Because the global /listings endpoint may return 500 without a filter,
            // we fetch units per property instead to ensure stability.
            // Fetch units sequentially to avoid overwhelming the backend and causing 500 errors
            const unitsArrays = []
            for (const p of apiProperties) {
                try {
                    const propertyUnits = await listingsService.listByProperty(p.uuid)
                    unitsArrays.push(propertyUnits)
                } catch (e) {
                    console.error(`Failed to fetch units for property ${p.uuid}`, e)
                    unitsArrays.push([])
                }
            }
            const apiUnits = unitsArrays.flat()
            
            const convertedProperties: Property[] = apiProperties.map((apiProp, index) => {
                const formData = apiResponseToFormData(apiProp)
                return {
                    id: apiProp.uuid || String(index + 1),
                    uuid: apiProp.uuid,
                    user_id: 1,
                    name: formData.name,
                    description: formData.description || "",
                    email: formData.email,
                    phone: formData.phone,
                    address: {
                        line1: formData.address,
                        city: formData.city,
                        country: "Colombia"
                    },
                    address_detail: formData.addressDetail,
                    city: formData.city,
                    state: formData.state,
                    country_id: formData.countryId,
                    geo_location: formData.latitude && formData.longitude 
                        ? `${formData.latitude},${formData.longitude}` 
                        : null,
                    timezone: formData.timezone,
                    status_record_id: formData.statusRecordId,
                    status: formData.statusRecordId === 1 || formData.statusRecordId === 6 ? "ACTIVE" : "INACTIVE",
                    type: String(apiProp.propertyTypeId || apiProp.property_type_id || formData.propertyTypeId || apiProp.extra?.propertyTypeId || apiProp.extra?.type || "102"),
                    created_at: apiProp.createdAt,
                    updated_at: apiProp.updatedAt,
                    extra: {
                        ...apiProp.extra,
                        propertyTypeId: formData.propertyTypeId,
                        type: apiProp.extra?.type || (formData.propertyTypeId === 101 ? "HOTEL" : "BUILDING"),
                        thumbnailUrl: formData.thumbnailUrl,
                    }
                } as unknown as Property
            })
            
            setProperties(convertedProperties)
            
            const convertedUnits: Unit[] = apiUnits.map((u: any, index) => {
                const uPrice = Number(u.price || u.start_price || u.startPrice || u.total_price || u.extra?.startPrice || 0)
                const isActive = (u.statusRecordId === 1 || u.statusRecordId === 6 || u.status_record_id === 1 || u.status_record_id === 6 || u.statusRecord?.id === 1 || u.statusRecord?.id === 6)
                
                return {
                    id: u.uuid || String(index + 1),
                    uuid: u.uuid,
                    propertyId: u.propertyUuid || u.property_uuid || u.property_id || "", 
                    name: u.name,
                    number: u.internalName || u.internal_name || "",
                    type: "ENTIRE_PLACE", 
                    capacity: u.extra?.maxOccupancy || u.extra?.max_occupancy || u.maxOccupancy || 2,
                    amenities: [],
                    pricePerNight: uPrice,
                    status: isActive ? "ACTIVE" : "INACTIVE",
                    inheritWifi: false
                } as Unit
            })
            setUnits(convertedUnits) 
        } catch (error) {
            console.error("[PropertiesList] Error fetching data:", error)
            setProperties([])
            setUnits([])
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-brand-navy)] drop-shadow-sm">Propiedades y Alojamientos</h2>
                    <p className="text-[var(--color-brand-navy)]/60 text-sm font-medium">
                        Gestiona tus propiedades, unidades y configuraciones de automatización.
                    </p>
                </div>
                <Button asChild className="bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-blue)] hover:opacity-90 text-white shadow-lg shadow-brand-purple/20 border-none px-6 h-11 transition-all duration-300 transform hover:scale-[1.02]">
                    <Link href="/dashboard/properties/new">
                        <Plus className="mr-2 h-5 w-5" /> Añadir Propiedad
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="properties" className="space-y-6">
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
                            <SelectTrigger className="w-[140px] h-10 border-slate-200">
                                <div className="flex items-center gap-2 pointer-events-none">
                                    <Filter className="h-3 w-3 text-slate-400" />
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
                                <PropertyCard key={property.id} property={property} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="units" className="space-y-6 outline-none">
                    <div className="bg-white rounded-2xl border-[1.5px] border-[var(--color-brand-purple)]/10 shadow-2xl shadow-brand-purple/5 overflow-hidden">
                        <div className="p-5 border-b bg-gradient-to-r from-[var(--color-brand-purple)]/[0.03] to-[var(--color-brand-blue)]/[0.03] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-[var(--color-brand-purple)] p-2 rounded-lg text-white">
                                    <LayoutGrid size={20} />
                                </div>
                                <h3 className="font-extrabold text-[var(--color-brand-navy)] text-lg">Listado de Alojamientos</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtrar por Propiedad:</span>
                                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                                    <SelectTrigger className="w-[200px] h-8 text-xs">
                                        <SelectValue placeholder="Propiedad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todas las Propiedades</SelectItem>
                                        {properties.map((p: Property) => (
                                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
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
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
