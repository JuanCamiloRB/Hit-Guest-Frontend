"use client"

import React from "react"
import { AutomationStatus } from "@/types"
import { cn } from "@/lib/utils"
import { Send, CheckCircle2, Smartphone, Key, Shield, XCircle } from "lucide-react"

interface AutomationTrafficLightProps {
    status?: AutomationStatus
}

export function AutomationTrafficLight({ status }: AutomationTrafficLightProps) {
    if (!status) return <div className="flex gap-1 text-slate-300">{"-".repeat(6)}</div>

    const indicators = [
        { key: "link" as keyof AutomationStatus, label: "LINK", icon: Send, title: "Link de Reserva" },
        { key: "checkin" as keyof AutomationStatus, label: "CHECK-IN", icon: CheckCircle2, title: "Check-in Online" },
        { key: "contract" as keyof AutomationStatus, label: "CONTRATO", icon: Smartphone, title: "Contrato de Arrendamiento" },
        { key: "code" as keyof AutomationStatus, label: "CÓDIGO", icon: Key, title: "Código de Acceso" },
        { key: "tra" as keyof AutomationStatus, label: "TRA", icon: Shield, title: "TRA" },
        { key: "sire" as keyof AutomationStatus, label: "SIRE", icon: XCircle, title: "SIRE" },
    ]

    return (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {indicators.map((indicator) => {
                const state = status[indicator.key]
                const Icon = indicator.icon

                return (
                    <div key={indicator.key} className="relative group flex items-center">
                        <div
                            className={cn(
                                "inline-flex items-center justify-center rounded-full border border-transparent shadow-sm cursor-help transition-all hover:scale-105",
                                "h-8 w-8 sm:h-auto sm:w-auto sm:min-w-[100px] sm:px-3 sm:py-1.5 text-xs font-bold sm:gap-2",
                                state === "success"
                                    ? "bg-[#d4f7e6] text-[#0bb37a]"
                                    : state === "pending"
                                        ? "bg-[#fff3c4] text-[#ffb000]"
                                        : "bg-[#f1f5f9] text-[#64748b]"
                            )}
                        >
                            <Icon className={cn(
                                "h-4 w-4 shrink-0",
                                state === "success" ? "text-[#0bb37a]"
                                    : state === "pending" ? "text-[#ffb000]"
                                        : "text-[#94a3b8]"
                            )} />
                            <span className="hidden sm:inline leading-none tracking-wider uppercase">{indicator.label}</span>
                        </div>
                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-50">
                            {indicator.title}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
