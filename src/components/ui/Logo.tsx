import * as React from "react"
import { cn } from "@/lib/utils"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    variant?: "full" | "icon"
    showText?: boolean
    isWhite?: boolean
}

export function Logo({ className, variant = "full", showText = true, isWhite = false, ...props }: LogoProps) {
    const mainColor = isWhite ? "#ffffff" : "#222755" // White for sidebar, Navy for header
    const dotColor = "#9D4CF2" // Always the brand purple dot as requested

    // Replicating exactly the HIT logo proportions from image
    const LogoIcon = () => (
        <svg
            viewBox="0 0 100 66"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(variant === "icon" ? "h-10 w-auto" : "h-11 w-auto", className)}
            {...props}
        >
            {/* H Part */}
            <rect x="0" y="0" width="14" height="66" fill={mainColor} />
            <rect x="14" y="24" width="22" height="15" fill={mainColor} />
            <rect x="36" y="24" width="14" height="42" fill={mainColor} />
            
            {/* dot of i */}
            <rect x="36" y="0" width="14" height="18" fill={dotColor} />
            
            {/* T/r Part */}
            <rect x="56" y="0" width="14" height="66" fill={mainColor} />
            <rect x="70" y="0" width="30" height="18" fill={mainColor} />
        </svg>
    )

    if (variant === "icon") return <LogoIcon />

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <LogoIcon />
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
