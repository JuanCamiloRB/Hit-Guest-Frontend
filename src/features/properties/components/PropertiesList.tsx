"use client"

import { useState, useMemo } from "react"
import { Property, Unit } from "@/types"
import { PropertyCard } from "./PropertyCard"
import { Button } from "@/components/ui/button"
import { Plus, Search, Filter, Home, LayoutGrid, List } from "lucide-react"
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
import { mockUnits, mockProperties } from "../services/properties"

export function PropertiesList() {
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [propertyFilter, setPropertyFilter] = useState<string>("ALL")

    const filteredProperties = useMemo(() => {
        return mockProperties.filter((property: Property) => {
            const matchesSearch =
                property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                property.address.line1.toLowerCase().includes(searchQuery.toLowerCase()) ||
                property.address.city.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus = statusFilter === "ALL" || property.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [searchQuery, statusFilter])

    const filteredUnits = useMemo(() => {
        return mockUnits.filter((unit: Unit) => {
            const property = mockProperties.find((p: Property) => p.id === unit.propertyId)
            const matchesSearch =
                unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                unit.number.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus = statusFilter === "ALL" || unit.status === statusFilter
            const matchesProperty = propertyFilter === "ALL" || unit.propertyId === propertyFilter
            return matchesSearch && matchesStatus && matchesProperty
        })
    }, [searchQuery, statusFilter, propertyFilter])

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Propiedades y Alojamientos</h2>
                    <p className="text-slate-500 text-sm">
                        Gestiona tus propiedades, unidades y configuraciones de automatización.
                    </p>
                </div>
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                    <Link href="/dashboard/properties/new">
                        <Plus className="mr-2 h-4 w-4" /> Añadir Propiedad
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="properties" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-xl border shadow-sm">
                    <TabsList className="grid grid-cols-2 w-full md:w-[400px]">
                        <TabsTrigger value="properties" className="gap-2">
                            <Home className="h-4 w-4" /> Propiedades
                        </TabsTrigger>
                        <TabsTrigger value="units" className="gap-2">
                            <List className="h-4 w-4" /> Alojamientos
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex flex-1 items-center gap-3 px-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nombre o número..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] h-10 border-slate-200">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-3 w-3 text-slate-400" />
                                    <span>{statusFilter === "ALL" ? "Estado" : statusFilter === "ACTIVE" ? "Activo" : "Inactivo"}</span>
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
                    {filteredProperties.length === 0 ? (
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
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutGrid size={18} className="text-indigo-600" />
                                <h3 className="font-bold text-slate-800">Listado de Alojamientos</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtrar por Propiedad:</span>
                                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                                    <SelectTrigger className="w-[200px] h-8 text-xs">
                                        <SelectValue placeholder="Propiedad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Todas las Propiedades</SelectItem>
                                        {mockProperties.map((p: Property) => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Número</TableHead>
                                    <TableHead>Nombre Alojamiento</TableHead>
                                    <TableHead>Propiedad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Capacidad</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
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
                                        const property = mockProperties.find((p: Property) => p.id === unit.propertyId)
                                        return (
                                            <TableRow key={unit.id} className="hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="font-bold text-indigo-600">{unit.number}</TableCell>
                                                <TableCell className="font-medium">{unit.name}</TableCell>
                                                <TableCell className="text-slate-500 text-sm">{property?.name}</TableCell>
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
                                                <TableCell className="text-sm">{unit.capacity} Huéspedes</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">
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
