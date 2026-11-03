import type { ReactNode } from "react"
import { Building2, Globe2 } from "lucide-react"
import { siAirbnb, siBookingdotcom, siExpedia, siTripadvisor, type SimpleIcon } from "simple-icons"
import { cn } from "@/lib/utils"

/**
 * Logos de marca de los canales de reserva y orígenes de sincronización,
 * provenientes de Simple Icons (`simple-icons`; la misma fuente que su webfont
 * `simple-icons-font`, pero como SVG: solo viajan los logos que se usan y no
 * hay que descargar una fuente de miles de íconos). Las marcas
 * que simple-icons no tiene (Vrbo, Despegar, Agoda, PMS propios como KunasPMS)
 * usan el ícono NEUTRO hasta tener un asset de marca aprobado: un logo
 * inventado se presentaría como real. «Directo» no es una marca: lleva un
 * ícono genérico de edificio.
 *
 * Solo presentación: los ids y las claves que viajan al backend no cambian.
 */

interface BrandVisual {
    /** Color de la marca (texto, para `fill-current`). */
    color: string
    /** Fondo suave para la versión en tarjeta. */
    background: string
    render: (className: string) => ReactNode
}

function simpleIcon(icon: SimpleIcon) {
    function SimpleIconMark(className: string) {
        return (
            <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden="true">
                <path d={icon.path} />
            </svg>
        )
    }
    return SimpleIconMark
}

const BRANDS: Readonly<Record<string, BrandVisual>> = {
    direct: { color: "text-violet-700", background: "bg-violet-50", render: (c) => <Building2 className={c} aria-hidden="true" /> },
    airbnb: { color: "text-[#ff385c]", background: "bg-[#fff1f2]", render: simpleIcon(siAirbnb) },
    booking: { color: "text-[#003a9a]", background: "bg-[#eef4ff]", render: simpleIcon(siBookingdotcom) },
    expedia: { color: "text-[#191e3b]", background: "bg-[#eef0f7]", render: simpleIcon(siExpedia) },
    tripadvisor: { color: "text-[#00aa6c]", background: "bg-[#e9fbf4]", render: simpleIcon(siTripadvisor) },
}

/** Alias de nombre o slug → marca. «Booking», «Booking.com», «booking_com» son lo mismo. */
const ALIASES: Readonly<Record<string, string>> = {
    direct: "direct", directo: "direct",
    airbnb: "airbnb",
    booking: "booking", bookingcom: "booking",
    expedia: "expedia",
    tripadvisor: "tripadvisor",
}

/** La marca de un slug o un nombre de canal; `null` si no tiene logo propio. */
export function channelBrand(slugOrName: string | null | undefined): string | null {
    const key = (slugOrName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
    return ALIASES[key] ?? null
}

/** El fondo suave de la marca, para la versión en tarjeta (`ReservationSourceIdentity`). */
export function channelBackground(brand: string | null): string {
    return (brand && BRANDS[brand]?.background) || "bg-slate-100"
}

interface ChannelLogoProps {
    /** Slug del backend o nombre del canal: se acepta cualquiera de los dos. */
    channel: string | null | undefined
    className?: string
}

/**
 * El logo del canal con su color. Sin logo propio, una marca neutra: nunca un
 * logo equivocado. Decorativo (`aria-hidden`): el nombre va siempre al lado.
 */
export function ChannelLogo({ channel, className = "h-4 w-4" }: ChannelLogoProps) {
    const brand = channelBrand(channel)
    const visual = brand ? BRANDS[brand] : undefined
    if (!visual) return <Globe2 className={cn("shrink-0 text-slate-400", className)} aria-hidden="true" />
    return <span className={cn("inline-flex shrink-0", visual.color)}>{visual.render(className)}</span>
}
