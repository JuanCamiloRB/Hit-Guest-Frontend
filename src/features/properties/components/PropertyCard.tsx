"use client"

import Image from "next/image"
import { MoreHorizontal, MapPin, Building, Hotel, Home as HomeIcon, Palmtree } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Property } from "@/types"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface PropertyCardProps {
    property: Property
}

const TypeIcon = ({ type }: { type?: string | number }) => {
    const t = String(type || '').toUpperCase()
    switch (t) {
        case 'HOTEL':
        case '101': 
            return <Hotel className="h-3 w-3" />
        case 'BUILDING':
        case '102':
        case 'APARTMENT': 
        case 'APARTAHOTEL':
            return <Building className="h-3 w-3" />
        case 'HOUSE':
        case '100': 
            return <HomeIcon className="h-3 w-3" />
        case 'RESORT': return <Palmtree className="h-3 w-3" />
        default: return <Building className="h-3 w-3" />
    }
}

const TypeLabel = ({ type }: { type?: string | number }) => {
    const t = String(type || '').toUpperCase()
    switch (t) {
        case 'HOTEL':
        case '101': return 'Hotel'
        case 'APARTAHOTEL': return 'Apartahotel'
        case 'BUILDING':
        case '102':
        case 'APARTMENT': return 'Apartamento / Edificio'
        case 'HOUSE':
        case '100': return 'Casa / Villa'
        case 'RESORT': return 'Resort'
        case 'HOSTAL': return 'Hostal'
        default: return 'Propiedad'
    }
}

export function PropertyCard({ property }: PropertyCardProps) {
    // Determine the identifier to use for detail links
    const propertyId = property.uuid || property.id

    return (
        <Card className="overflow-hidden group hover:shadow-2xl hover:shadow-brand-purple/10 transition-all duration-500 border-[var(--color-brand-purple)]/10 hover:border-[var(--color-brand-purple)]/30 rounded-2xl bg-white/50 backdrop-blur-sm">
            <div className="relative aspect-video">
                <Image
                    src={property.thumbnailUrl || "/placeholder.svg"}
                    alt={property.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="absolute top-2 left-2 flex gap-1">
                    <Badge className="bg-white/90 text-slate-900 border-none shadow-sm backdrop-blur-sm flex gap-1.5 items-center px-2 py-0.5">
                        <TypeIcon type={property.type} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{TypeLabel({ type: property.type })}</span>
                    </Badge>
                </div>

                <Badge
                    variant={property.status === "ACTIVE" ? "default" : "secondary"}
                    className={cn(
                        "absolute right-2 top-2 px-2 py-0.5 text-[10px] font-bold border-none shadow-sm",
                        property.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-500"
                    )}
                >
                    {property.status === "ACTIVE" ? "ACTIVO" : "INACTIVO"}
                </Badge>
            </div>
            <CardHeader className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                    <div className="grid gap-1">
                        <h3 className="font-extrabold text-lg leading-tight text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-purple)] transition-colors duration-300">
                            {property.name}
                        </h3>
                        <div className="flex items-center text-xs text-[var(--color-brand-navy)]/60 font-medium">
                            <MapPin className="mr-1 h-3.3 w-3.3 text-[var(--color-brand-blue)]" />
                            {property.address?.city || "Ciudad"}, {property.address?.country || "País"}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mt-1 h-8 w-8 hover:bg-slate-100 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuLabel>Gestión</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/properties/${propertyId}`} className="flex items-center">
                                    Editar Detalles
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/dashboard/properties/${propertyId}?tab=automation`} className="flex items-center">
                                    Automatizaciones
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive font-medium">
                                Desactivar Propiedad
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardFooter className="p-4 pt-0">
                <Button variant="outline" className="w-full border-[var(--color-brand-purple)]/20 text-[var(--color-brand-navy)] hover:bg-[var(--color-brand-purple)] hover:text-white hover:border-transparent transition-all duration-300 font-bold rounded-xl shadow-sm hover:shadow-lg hover:shadow-brand-purple/20" asChild>
                    <Link href={`/dashboard/properties/${propertyId}`}>Gestionar</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
