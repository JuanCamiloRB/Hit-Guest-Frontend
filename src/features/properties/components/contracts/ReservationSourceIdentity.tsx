"use client"

import { Building2, Globe2, Plane } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReservationSource } from "../../services/reservation-source-service"

interface BrandVisual {
    background: string
    foreground: string
    mark: "airbnb" | "booking" | "vrbo" | "expedia" | "despegar" | "agoda" | "direct"
}

/**
 * Presentational metadata only. Channel ids still come exclusively from
 * GET /reservation-sources and remain the keys sent in `by_source`.
 */
const BRAND_BY_SOURCE_ID: Readonly<Record<number, BrandVisual>> = {
    21: { background: "bg-violet-50", foreground: "text-violet-700", mark: "direct" },
    22: { background: "bg-[#fff1f2]", foreground: "text-[#ff385c]", mark: "airbnb" },
    23: { background: "bg-[#eef4ff]", foreground: "text-[#003b95]", mark: "booking" },
    24: { background: "bg-[#f1f0ff]", foreground: "text-[#3b2b8f]", mark: "vrbo" },
    25: { background: "bg-[#fff3e8]", foreground: "text-[#f36f21]", mark: "despegar" },
    26: { background: "bg-[#fff7df]", foreground: "text-[#172b4d]", mark: "expedia" },
    846: { background: "bg-[#fff0f5]", foreground: "text-[#e91e63]", mark: "agoda" },
}

export function reservationSourceName(source: ReservationSource): string {
    const translated = source.name_translations?.es
    return typeof translated === "string" && translated.trim() ? translated : source.name
}

function AirbnbMark() {
    return (
        <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current" aria-hidden="true">
            <path d="M16 2.5c2 0 3.35 1.2 4.6 3.7 2.5 5 5.8 12 7.1 15.1.5 1.2.8 2.2.8 3.2 0 3.2-2.3 5.5-5.4 5.5-2.4 0-4.8-1.4-7.1-3.8-2.3 2.4-4.7 3.8-7.1 3.8-3.1 0-5.4-2.3-5.4-5.5 0-1 .3-2 .8-3.2C5.6 18.2 9 11.2 11.4 6.2 12.65 3.7 14 2.5 16 2.5Zm0 2c-1 0-1.8.6-2.8 2.6-2.3 4.7-5.8 12-7 14.9-.5 1.1-.7 1.9-.7 2.5 0 2 1.4 3.5 3.4 3.5 1.8 0 3.8-1.2 5.8-3.4l.2-.2A7.1 7.1 0 0 1 12 19c0-2.2 1.8-4 4-4s4 1.8 4 4a7.1 7.1 0 0 1-2.9 5.4l.2.2c2 2.2 4 3.4 5.8 3.4 2 0 3.4-1.5 3.4-3.5 0-.6-.2-1.4-.7-2.5-1.2-2.9-4.7-10.2-7-14.9-1-2-1.8-2.6-2.8-2.6Zm0 12.5c-1.1 0-2 .9-2 2 0 1.2.7 2.6 2 4 1.3-1.4 2-2.8 2-4 0-1.1-.9-2-2-2Z" />
        </svg>
    )
}

function BrandMark({ visual, name }: { visual: BrandVisual | undefined; name: string }) {
    switch (visual?.mark) {
        case "airbnb": return <AirbnbMark />
        case "booking": return <span className="text-lg font-black tracking-[-0.08em]">B.</span>
        case "vrbo": return <span className="text-sm font-black tracking-[-0.08em]">vrbo</span>
        case "expedia": return <Plane className="h-6 w-6 -rotate-12" aria-hidden="true" />
        case "despegar": return <Plane className="h-6 w-6" aria-hidden="true" />
        case "agoda": return <span className="text-base font-black tracking-[-0.12em]">ago</span>
        case "direct": return <Building2 className="h-6 w-6" aria-hidden="true" />
        default: return name.trim() ? <span className="text-lg font-black">{name.trim().charAt(0).toUpperCase()}</span> : <Globe2 className="h-6 w-6" />
    }
}

interface Props {
    source?: ReservationSource | null
    /** Used for "Todos los canales" and corrupted/unknown source rows. */
    fallbackName?: string
    compact?: boolean
    className?: string
}

export function ReservationSourceIdentity({ source, fallbackName = "Canal", compact = false, className }: Props) {
    const name = source ? reservationSourceName(source) : fallbackName
    const visual = source ? BRAND_BY_SOURCE_ID[source.id] : undefined

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
                <BrandMark visual={visual} name={name} />
            </span>
            <span className={cn("truncate font-bold text-slate-900", compact ? "text-sm" : "text-lg")}>{name}</span>
        </div>
    )
}

