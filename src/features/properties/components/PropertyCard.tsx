"use client"

import { MoreHorizontal, MapPin, Building, Hotel, Home as HomeIcon, Palmtree, Loader2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useState } from "react"
import { usePropertyTypeLabel } from "../hooks/usePropertyTypeLabel"

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
import type { PropertyBadge } from "../lib/property-badges"
import { RECORD_STATUS } from "../lib/record-status"
import { DeactivationConfirmDialog } from "./DeactivationConfirmDialog"

interface PropertyCardProps {
    property: Property
    onStatusChange?: (uuid: string, newStatus: "ACTIVE" | "INACTIVE") => void
    /** `null` = el agregado todavía no llegó — se muestra "—", nunca un 0 inventado. */
    activeListings?: number | null
    /** `null` = no se pudo consultar: no se afirma nada (tampoco ausencias). */
    badges?: PropertyBadge[] | null
}

/** Tono visual por clase de insignia — presentación, la derivación vive en `property-badges.ts`. */
const BADGE_STYLES: Record<PropertyBadge["kind"], string> = {
    identity: "bg-primary/10 text-primary border-primary/20",
    contract: "bg-info-sunk text-info border-info/30",
    ops: "bg-success-sunk text-success border-success/30",
    absent: "bg-sunk text-ink-3 border-rule",
}

/**
 * Ícono por palabra clave sobre la etiqueta del catálogo (viene en inglés o en
 * español según el catálogo). No hay switch por id: el que había asumía
 * 100/101/102 = Casa/Hotel/Apartamento, y en el catálogo real 102 es Hotel.
 */
const PropertyTypeIcon = ({ label }: { label: string | null }) => {
    const l = (label || "").toLowerCase()
    if (l.includes("hotel")) return <Icon icon={Hotel} size="xs" />
    if (l.includes("resort")) return <Icon icon={Palmtree} size="xs" />
    if (l.includes("casa") || l.includes("villa") || l.includes("house")) return <Icon icon={HomeIcon} size="xs" />
    return <Icon icon={Building} size="xs" />
}

export function PropertyCard({ property, onStatusChange, activeListings = null, badges = null }: PropertyCardProps) {
    const propertyId = property.uuid || property.id
    // La etiqueta sale SOLO del catálogo `property_type`. Sin tipo informado se
    // dice; mientras el catálogo carga (o si no carga) no se adivina ninguna.
    const hasType = property.type != null && String(property.type) !== ""
    const catalogLabel = usePropertyTypeLabel(hasType ? property.type : null)
    const typeLabel = hasType ? catalogLabel : "Sin tipo"
    const [isActive, setIsActive] = useState(property.status === "ACTIVE")
    const [isToggling, setIsToggling] = useState(false)
    // Desactivar pide confirmación ANTES de cualquier PATCH: el switch no se
    // mueve hasta que el PM confirma.
    const [confirmingDeactivation, setConfirmingDeactivation] = useState(false)
    const [imgError, setImgError] = useState(false)

    // Cover photo: prefer the top-level thumbnail, then the gallery's first image
    // (camelCase or snake_case). Uploaded photos live on the backend/S3 host, so we
    // render with a plain <img> to avoid next/image's remotePatterns allow-list and
    // fall back to the placeholder if the URL is missing or fails to load.
    const extra = (property as { extra?: Record<string, unknown> }).extra ?? {}
    const gallery = (extra.picturesUrl ?? extra.pictures_url) as string[] | undefined
    const coverUrl =
        property.thumbnailUrl ||
        (extra.thumbnailUrl as string | undefined) ||
        (Array.isArray(gallery) ? gallery[0] : undefined) ||
        ""
    const coverSrc = coverUrl && !imgError ? coverUrl : "/placeholder.svg"

    /** Activar va directo; desactivar abre la confirmación. */
    const requestStatusChange = (checked: boolean) => {
        if (!property.uuid || isToggling) return
        if (!checked && isActive) {
            setConfirmingDeactivation(true)
            return
        }
        void handleStatusToggle(checked)
    }

    const handleStatusToggle = async (checked: boolean) => {
        if (!property.uuid) return
        setIsToggling(true)
        const newStatusRecordId = checked ? RECORD_STATUS.ACTIVE : RECORD_STATUS.INACTIVE
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
        <Card className="overflow-hidden group hover:shadow-sm transition-all duration-500 border-primary/10 hover:border-primary/30 rounded-xl bg-white/50 backdrop-blur-sm">
            <div className="relative aspect-video bg-sunk">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={coverSrc}
                    alt={property.name}
                    onError={() => setImgError(true)}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {typeLabel && (
                    <div className="absolute top-2 left-2 flex gap-1">
                        <Badge className="bg-white/90 text-ink border-none shadow-sm backdrop-blur-sm flex gap-1.5 items-center px-2 py-0.5">
                            <PropertyTypeIcon label={hasType ? typeLabel : null} />
                            <span className="text-xs font-bold">{typeLabel}</span>
                        </Badge>
                    </div>
                )}

                <Badge
                    variant={isActive ? "default" : "secondary"}
                    className={cn(
                        "absolute right-2 top-2 px-2 py-0.5 text-xs font-bold border-none shadow-sm transition-colors duration-300",
                        isActive ? "bg-success" : "bg-ink-3"
                    )}
                >
                    {isActive ? "ACTIVO" : "INACTIVO"}
                </Badge>
            </div>
            <CardHeader className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                    <div className="grid gap-1">
                        <h3 className="font-bold text-lg leading-tight text-ink group-hover:text-primary transition-colors duration-300">
                            {property.name}
                        </h3>
                        <div className="flex items-center text-xs text-ink-2 font-medium">
                            <Icon icon={MapPin} size="sm" className="mr-1 text-secondary" />
                            {property.address?.city || "Ciudad"}, {property.address?.country || "País"}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="-mt-1 rounded-full" aria-label={`Acciones de ${property.name}`}>
                                <Icon icon={MoreHorizontal} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-45">
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
                                className={cn("font-medium", isActive ? "text-destructive" : "text-success")}
                                // Diferido: abrir el diálogo mientras el menú se cierra deja
                                // `pointer-events: none` en el body (fallo conocido de Radix).
                                onSelect={() => window.setTimeout(() => requestStatusChange(!isActive), 0)}
                            >
                                {isActive ? "Desactivar Propiedad" : "Activar Propiedad"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Alojamientos activos + automatizaciones encendidas (del BFF agregado) */}
                <div className="space-y-2">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold text-ink tabular-nums">
                            {activeListings ?? "—"}
                        </span>
                        <span className="text-xs font-bold text-ink-3">
                            {activeListings === 1 ? "Alojamiento activo" : "Alojamientos activos"}
                        </span>
                    </div>
                    {/* `badges === null` = no se pudo consultar: no se pinta nada,
                        porque afirmar "Sin cerradura" sin el dato sería mentir. */}
                    {badges && badges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {badges.map((badge) => (
                                <Badge
                                    key={badge.key}
                                    variant="outline"
                                    className={cn("px-2 py-0.5 text-xs font-bold border", BADGE_STYLES[badge.kind])}
                                >
                                    {badge.label}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                {/* Status switch */}
                <div className="flex items-center justify-between px-1 py-2 bg-sunk/50 rounded-xl border border-rule">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-ink">Estado de la propiedad</span>
                        <span className={cn(
                            "text-xs font-semibold transition-colors duration-300",
                            isActive ? "text-success" : "text-ink-3"
                        )}>
                            {isActive ? "Visible y activa" : "Oculta / Inactiva"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isToggling && <Icon icon={Loader2} size="xs" className="animate-spin text-ink-3" />}
                        <Switch
                            checked={isActive}
                            onCheckedChange={requestStatusChange}
                            disabled={isToggling}
                            // Sin colores propios: la primitiva Switch ya define encendido
                            // (primary) y apagado (ink-3, 3:1). Antes pisaba con verde y slate-300.
                            aria-label="Estado de la propiedad"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardFooter className="p-4 pt-0">
                <Button variant="outline" className="w-full border-primary/20 text-ink hover:bg-primary hover:text-white hover:border-transparent transition-all duration-300 font-bold rounded-xl shadow-sm hover:shadow-sm" asChild>
                    <Link href={`/dashboard/properties/${propertyId}`}>Gestionar</Link>
                </Button>
            </CardFooter>
            <DeactivationConfirmDialog
                target={confirmingDeactivation ? { kind: "property", name: property.name, uuid: property.uuid } : null}
                onConfirm={() => {
                    setConfirmingDeactivation(false)
                    void handleStatusToggle(false)
                }}
                onCancel={() => setConfirmingDeactivation(false)}
            />
        </Card>
    )
}
