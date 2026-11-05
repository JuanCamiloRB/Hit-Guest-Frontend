"use client"

import { ChannelLogo, channelBackground, channelBrand } from "@/components/brand/ChannelLogo"
import { cn } from "@/lib/utils"
import type { ReservationSource } from "../../services/reservation-source-service"
import { LEGACY_CHANNEL_SLUG_BY_ID } from "@/lib/reservation-channel"

export function reservationSourceName(source: ReservationSource): string {
    const translated = source.name_translations?.es
    return typeof translated === "string" && translated.trim() ? translated : source.name
}

export function reservationSourceSlug(source: ReservationSource): string | null {
    return source.slug || LEGACY_CHANNEL_SLUG_BY_ID[source.id] || null
}

interface Props {
    name: string
    slug?: string | null
    compact?: boolean
    className?: string
}

/**
 * Logo + nombre del canal, en tarjeta. El logo sale de `ChannelLogo` (el mismo
 * de la lista de reservas y del selector de origen), por el `slug` del canal
 * (contrato 2026-10-19): el backend no sirve imágenes. Una marca sin logo
 * (Vrbo, Despegar, Agoda, KunasPMS) lleva el ícono neutro, como en el resto.
 */
export function ReservationSourceIdentity({ name, slug, compact = false, className }: Props) {
    const brand = channelBrand(slug)

    return (
        <div className={cn("flex min-w-0 items-center", compact ? "gap-2" : "gap-3", className)}>
            <span
                className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl border border-black/5 text-slate-600",
                    compact ? "h-9 w-9 rounded-lg" : "h-12 w-12",
                    channelBackground(brand),
                )}
                aria-hidden="true"
            >
                {/* Sin logo de marca, el mismo ícono neutro que la lista y el selector
                    de origen: una sola regla en todo el panel. */}
                <ChannelLogo channel={brand} className={compact ? "h-5 w-5" : "h-6 w-6"} />
            </span>
            <span className={cn("truncate font-bold text-slate-900", compact ? "text-sm" : "text-lg")}>{name}</span>
        </div>
    )
}
