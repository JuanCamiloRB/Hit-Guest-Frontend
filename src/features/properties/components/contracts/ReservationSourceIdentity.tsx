"use client"

import type { ReactNode } from "react"
import { Building2, Globe2, Plane } from "lucide-react"
import { siAirbnb, siBookingdotcom, siExpedia, siTripadvisor, type SimpleIcon } from "simple-icons"
import { cn } from "@/lib/utils"
import type { ReservationSource } from "../../services/reservation-source-service"

interface BrandVisual {
    background: string
    foreground: string
    mark: ReactNode
}

function SimpleIconMark({ icon }: { icon: SimpleIcon }) {
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
            <path d={icon.path} />
        </svg>
    )
}

/**
 * Solo presentación, por el `slug` del canal (contrato 2026-10-19): el backend
 * no sirve imágenes. Los ids siguen saliendo de `GET /reservation-sources` y son
 * las claves de `by_source`. simple-icons no tiene Vrbo, Despegar ni Agoda.
 */
const BRAND_BY_SLUG: Readonly<Record<string, BrandVisual>> = {
    direct: { background: "bg-violet-50", foreground: "text-violet-700", mark: <Building2 className="h-6 w-6" aria-hidden="true" /> },
    airbnb: { background: "bg-[#fff1f2]", foreground: "text-[#ff385c]", mark: <SimpleIconMark icon={siAirbnb} /> },
    booking: { background: "bg-[#eef4ff]", foreground: "text-[#003a9a]", mark: <SimpleIconMark icon={siBookingdotcom} /> },
    expedia: { background: "bg-[#eef0f7]", foreground: "text-[#191e3b]", mark: <SimpleIconMark icon={siExpedia} /> },
    tripadvisor: { background: "bg-[#e9fbf4]", foreground: "text-[#00aa6c]", mark: <SimpleIconMark icon={siTripadvisor} /> },
    vrbo: { background: "bg-[#f1f0ff]", foreground: "text-[#3b2b8f]", mark: <span className="text-sm font-black tracking-[-0.08em]">vrbo</span> },
    despegar: { background: "bg-[#fff3e8]", foreground: "text-[#f36f21]", mark: <Plane className="h-6 w-6" aria-hidden="true" /> },
    agoda: { background: "bg-[#fff0f5]", foreground: "text-[#e91e63]", mark: <span className="text-base font-black tracking-[-0.12em]">ago</span> },
}

/**
 * Respaldo para un backend que todavía no manda `slug`: los ids del catálogo
 * de producción (skill de contratos). Borrar cuando `slug` llegue siempre.
 */
const LEGACY_SLUG_BY_ID: Readonly<Record<number, string>> = {
    21: "direct", 22: "airbnb", 23: "booking", 24: "vrbo", 25: "despegar", 26: "expedia", 846: "agoda",
}

export function reservationSourceName(source: ReservationSource): string {
    const translated = source.name_translations?.es
    return typeof translated === "string" && translated.trim() ? translated : source.name
}

export function reservationSourceSlug(source: ReservationSource): string | null {
    return source.slug || LEGACY_SLUG_BY_ID[source.id] || null
}

interface Props {
    name: string
    slug?: string | null
    compact?: boolean
    className?: string
}

export function ReservationSourceIdentity({ name, slug, compact = false, className }: Props) {
    const visual = slug ? BRAND_BY_SLUG[slug] : undefined
    const initial = name.trim().charAt(0).toUpperCase()

    return (
        <div className={cn("flex min-w-0 items-center", compact ? "gap-2" : "gap-3", className)}>
            <span
                className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl border border-black/5",
                    compact ? "h-9 w-9 rounded-lg" : "h-12 w-12",
                    visual?.background ?? "bg-slate-100",
                    visual?.foreground ?? "text-slate-600",
                )}
                aria-hidden="true"
            >
                {visual?.mark ?? (initial ? <span className="text-lg font-black">{initial}</span> : <Globe2 className="h-6 w-6" />)}
            </span>
            <span className={cn("truncate font-bold text-slate-900", compact ? "text-sm" : "text-lg")}>{name}</span>
        </div>
    )
}
