"use client"

import Image from "next/image"
import { MoreHorizontal, MapPin, BedDouble, Building, Hotel, Home as HomeIcon, Palmtree, User } from "lucide-react"

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

const TypeIcon = ({ type }: { type?: string }) => {
    switch (type) {
        case 'HOTEL': return <Hotel className="h-3 w-3" />
        case 'BUILDING': return <Building className="h-3 w-3" />
        case 'HOUSE': return <HomeIcon className="h-3 w-3" />
        case 'RESORT': return <Palmtree className="h-3 w-3" />
        default: return <Building className="h-3 w-3" />
    }
}

const TypeLabel = ({ type }: { type?: string }) => {
    switch (type) {
        case 'HOTEL': return 'Hotel'
        case 'APARTAHOTEL': return 'Apartahotel'
        case 'BUILDING': return 'Edificio'
        case 'HOUSE': return 'Casa / Villa'
        case 'RESORT': return 'Resort'
        case 'HOSTAL': return 'Hostal'
        default: return 'Propiedad'
    }
}

export function PropertyCard({ property }: PropertyCardProps) {
    return (
        <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-slate-200">
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
                        <h3 className="font-bold text-lg leading-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {property.name}
                        </h3>
                        <div className="flex items-center text-xs text-slate-500">
                            <MapPin className="mr-1 h-3 w-3 text-indigo-400" />
                            {property.address.city}, {property.address.country}
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
                                <Link href={`/dashboard/properties/${property.uuid}`} className="flex items-center">
                                    Editar Detalles
                                </Link>
                            </DropdownMenuItem>
<<<<<<< Updated upstream
                            <DropdownMenuItem>Automatizaciones</DropdownMenuItem>
=======
                             <DropdownMenuItem asChild>
                                <Link href={`/dashboard/properties/${property.uuid}?tab=automation`} className="flex items-center">
                                    Automatizaciones
                                </Link>
                            </DropdownMenuItem>
>>>>>>> Stashed changes
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive font-medium">
                                Desactivar Propiedad
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardFooter className="p-4 pt-0">
                <Button variant="outline" className="w-full border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all font-semibold" asChild>
                    <Link href={`/dashboard/properties/${property.uuid}`}>Gestionar</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
