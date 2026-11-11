import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

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
            <Label variant="plain" htmlFor="hp-field">{label}</Label>
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
