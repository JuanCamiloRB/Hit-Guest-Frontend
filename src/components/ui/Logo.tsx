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
                viewBox="0 0 70 70"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className={cn("h-10 w-10", className)}
                {...props}
            >
                {/* H / i stylized mark */}
                <rect x="0" y="0" width="20" height="70" />
                <rect x="20" y="30" width="20" height="20" />
                <rect x="40" y="30" width="20" height="40" />
                <rect x="40" y="0" width="20" height="20" fill="#9D4CF2" />
            </svg>
        )
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <svg
                viewBox="0 0 220 70"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-auto"
                {...props}
            >
                {/* Left vertical of H */}
                <rect x="0" y="0" width="20" height="70" />
                {/* Horizontal crossbar of H */}
                <rect x="20" y="30" width="20" height="20" />
                {/* Right vertical of H (lower part) */}
                <rect x="40" y="30" width="20" height="40" />

                {/* Purple dot of i */}
                <rect x="40" y="0" width="20" height="20" fill="#9D4CF2" />

                {/* T / Gamma shape */}
                <rect x="70" y="0" width="20" height="70" />
                <rect x="90" y="0" width="25" height="20" />

                {showText && (
                    <text
                        x="130"
                        y="52"
                        fill="currentColor"
                        className="font-sans font-bold text-[36px] tracking-tight"
                    >
                        Guest
                    </text>
                )}
            </svg>
        </div>
    )
}
