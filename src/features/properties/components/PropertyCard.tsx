"use client"

import Image from "next/image"
import { MoreHorizontal, MapPin, Building, Hotel, Home as HomeIcon, Palmtree, Loader2 } from "lucide-react"
import { useState } from "react"

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
import { Switch } from "@/components/ui/switch"
import { Property } from "@/types"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { propertiesService } from "../services/properties-service"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"

interface PropertyCardProps {
    property: Property
    onStatusChange?: (uuid: string, newStatus: "ACTIVE" | "INACTIVE") => void
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

export function PropertyCard({ property, onStatusChange }: PropertyCardProps) {
    const propertyId = property.uuid || property.id
    const [isActive, setIsActive] = useState(property.status === "ACTIVE")
    const [isToggling, setIsToggling] = useState(false)

    const handleStatusToggle = async (checked: boolean) => {
        if (!property.uuid) return
        setIsToggling(true)
        const newStatusRecordId = checked ? 6 : 7
        const prevIsActive = isActive

        // Optimistic update
        setIsActive(checked)

        try {
            await propertiesService.patch(property.uuid, {
                statusRecordId: newStatusRecordId,
            })

            onStatusChange?.(property.uuid, checked ? "ACTIVE" : "INACTIVE")
            toast.success(checked ? "Propiedad activada" : "Propiedad desactivada")
        } catch (err) {
            // Revert on error
            setIsActive(prevIsActive)
            notifyError(err, "No se pudo cambiar el estado")
        } finally {
            setIsToggling(false)
        }
    }

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
                    variant={isActive ? "default" : "secondary"}
                    className={cn(
                        "absolute right-2 top-2 px-2 py-0.5 text-[10px] font-bold border-none shadow-sm transition-colors duration-300",
                        isActive ? "bg-emerald-500" : "bg-slate-500"
                    )}
                >
                    {isActive ? "ACTIVO" : "INACTIVO"}
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
                            <DropdownMenuItem 
                                className={cn("font-medium", isActive ? "text-destructive" : "text-emerald-600")}
                                onSelect={() => handleStatusToggle(!isActive)}
                            >
                                {isActive ? "Desactivar Propiedad" : "Activar Propiedad"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Status switch */}
                <div className="flex items-center justify-between px-1 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-[var(--color-brand-navy)]">Estado de la propiedad</span>
                        <span className={cn(
                            "text-[10px] font-semibold transition-colors duration-300",
                            isActive ? "text-emerald-500" : "text-slate-400"
                        )}>
                            {isActive ? "Visible y activa" : "Oculta / Inactiva"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isToggling && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                        <Switch
                            checked={isActive}
                            onCheckedChange={handleStatusToggle}
                            disabled={isToggling}
                            className={cn(
                                "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300",
                                "transition-colors duration-300"
                            )}
                        />
                    </div>
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
