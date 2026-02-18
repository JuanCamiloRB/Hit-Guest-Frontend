import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface HoneypotProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

export function Honeypot({ className, label = "Website", ...props }: HoneypotProps) {
    return (
        <div
            className={cn("hidden", className)}
            aria-hidden="true"
            style={{ display: "none" }}
        >
            <label htmlFor="hp-field">{label}</label>
            <Input
                id="hp-field"
                name="hp-field"
                tabIndex={-1}
                autoComplete="off"
                {...props}
            />
        </div>
    )
}
