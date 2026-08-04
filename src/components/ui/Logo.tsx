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
// reconstruction. No "Guest" wordmark file exists yet, so every call site
// uses variant="icon" only (per the 20260804 decision — never show the text).
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
            className={cn("h-10 w-auto object-contain", variant === "icon" && className)}
        />
    )

    if (variant === "icon") return icon

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {icon}
            {showText && (
                <span className={cn(
                    "font-sans font-black text-[22px] leading-none tracking-tighter uppercase translate-y-[1px]",
                    isWhite ? "text-white" : "text-[#222755]"
                )}>
                    Guest
                </span>
            )}
        </div>
    )
}
