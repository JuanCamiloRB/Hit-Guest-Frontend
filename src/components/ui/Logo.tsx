import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
    className?: string
    variant?: "full" | "icon"
    showText?: boolean
    isWhite?: boolean
}

// Real brand icon exports (public/logos, copied from what Daniel sent as
// "Recurso 1.png"/"Recurso 8.png") — replaces the earlier hand-drawn SVG
// reconstruction. No "Guest" wordmark FILE exists; the wordmark is typeset.
// La decisión del 20260804 («nunca mostrar el texto») quedó revertida por
// producto el 2026-08-27: el logo del sidebar es HIT (hit.tools) y el del
// header interno es HIT GUEST — el lockup icon+«Guest» de `variant="full"` es
// exactamente para eso, y debe verse un poco MENOR que el ícono del sidebar.
const ICON_SRC = {
    light: "/logos/hit-icon-navy.png", // navy + purple dot — light backgrounds
    dark: "/logos/hit-icon-white.png", // solid white — dark/navy backgrounds
}
// Intrinsic size of the source PNGs. next/image needs width/height to fix the
// aspect ratio; actual display size is controlled via `className` (h-*, w-auto).
const ICON_WIDTH = 468
const ICON_HEIGHT = 292

export function Logo({ className, variant = "icon", showText = true, isWhite = false }: LogoProps) {
    const icon = (
        <Image
            src={isWhite ? ICON_SRC.dark : ICON_SRC.light}
            alt="HIT Guest"
            width={ICON_WIDTH}
            height={ICON_HEIGHT}
            // En el lockup completo el ícono va compacto (h-8): el logo de HIT
            // GUEST del header debe leerse menor que el de HIT del sidebar.
            className={cn(
                variant === "icon" ? "h-10 w-auto object-contain" : "h-8 w-auto object-contain",
                variant === "icon" && className,
            )}
        />
    )

    if (variant === "icon") return icon

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {icon}
            {showText && (
                <span className={cn(
                    "font-sans font-black text-[18px] leading-none tracking-tighter uppercase translate-y-[1px]",
                    isWhite ? "text-white" : "text-[#222755]"
                )}>
                    Guest
                </span>
            )}
        </div>
    )
}
