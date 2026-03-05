import * as React from "react"
import { cn } from "@/lib/utils"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    variant?: "full" | "icon"
    showText?: boolean
}

export function Logo({ className, variant = "full", showText = true, ...props }: LogoProps) {
    if (variant === "icon") {
        return (
            <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn("h-10 w-10", className)}
                {...props}
            >
                {/* Simplified Icon version - The "i" dot is the key element */}
                <rect x="0" y="0" width="100" height="100" rx="20" fill="currentColor" />
                <rect x="40" y="25" width="20" height="20" fill="#9D4CF2" />
            </svg>
        )
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <svg
                viewBox="0 0 240 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-auto"
                {...props}
            >
                {/* Construction based on Gabarito Bold proportions provided in manual */}
                {/* H */}
                <path
                    d="M10 10V70M10 40H40M40 10V70"
                    stroke="currentColor"
                    strokeWidth="14"
                    strokeLinecap="butt"
                />
                {/* i */}
                <path
                    d="M65 30V70"
                    stroke="currentColor"
                    strokeWidth="14"
                    strokeLinecap="butt"
                />
                <rect x="58" y="5" width="14" height="14" fill="#9D4CF2" />
                {/* T */}
                <path
                    d="M85 17H125M105 17V70"
                    stroke="currentColor"
                    strokeWidth="14"
                    strokeLinecap="butt"
                />

                {showText && (
                    <text
                        x="145"
                        y="58"
                        fill="currentColor"
                        className="font-sans font-bold text-[32px] tracking-tight"
                    >
                        Guest
                    </text>
                )}
            </svg>
        </div>
    )
}
