"use client"

import React from "react"
import { AutomationStatus } from "@/types"
import { cn } from "@/lib/utils"
import { Send, CheckCircle2, Smartphone, Key, Shield, XCircle } from "lucide-react"
import { Icon } from "@/components/ui/icon"

interface AutomationTrafficLightProps {
    status?: AutomationStatus
}

export function AutomationTrafficLight({ status }: AutomationTrafficLightProps) {
    if (!status) return <div className="flex gap-1 text-ink-4">{"-".repeat(6)}</div>

    const indicators = [
        { key: "link" as keyof AutomationStatus, label: "LINK", icon: Send, title: "Link de Reserva" },
        { key: "checkin" as keyof AutomationStatus, label: "CHECK-IN", icon: CheckCircle2, title: "Check-in Online" },
        { key: "contract" as keyof AutomationStatus, label: "CONTRATO", icon: Smartphone, title: "Contrato de Arrendamiento" },
        { key: "code" as keyof AutomationStatus, label: "CÓDIGO", icon: Key, title: "Código de Acceso" },
        { key: "tra" as keyof AutomationStatus, label: "TRA", icon: Shield, title: "TRA" },
        { key: "sireIn" as keyof AutomationStatus, label: "SIRE-IN", icon: XCircle, title: "SIRE Check-in" },
        { key: "sireOut" as keyof AutomationStatus, label: "SIRE-OUT", icon: XCircle, title: "SIRE Check-out" },
    ]

    return (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {indicators.map((indicator) => {
                const state = status[indicator.key]
                const glyph = indicator.icon

                return (
                    <div key={indicator.key} className="relative group flex items-center">
                        <div
                            className={cn(
                                "inline-flex items-center justify-center rounded-full border border-transparent shadow-sm cursor-help transition-all hover:scale-105",
                                "h-8 w-8 sm:h-auto sm:w-auto sm:min-w-25 sm:px-3 sm:py-1.5 text-xs font-bold sm:gap-2",
                                state === "success"
                                    ? "bg-success-sunk text-success"
                                    : state === "pending"
                                        ? "bg-warning-sunk text-warning"
                                        : "bg-sunk text-ink-3"
                            )}
                        >
                            <Icon icon={glyph} className={cn(
                                state === "success" ? "text-success"
                                    : state === "pending" ? "text-warning"
                                        : "text-ink-3"
                            )} />
                            <span className="hidden sm:inline leading-none">{indicator.label}</span>
                        </div>
                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-ink text-white text-xs font-medium px-2 py-1 rounded-xs shadow-md whitespace-nowrap pointer-events-none z-50">
                            {indicator.title}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
