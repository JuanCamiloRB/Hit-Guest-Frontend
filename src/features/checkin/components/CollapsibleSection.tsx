"use client"

import * as React from "react"
import { UnstyledButton } from "@/components/ui/unstyled-button"

interface CollapsibleSectionProps {
    icon: React.ReactNode
    title: string
    expanded: boolean
    onToggle: () => void
    children: React.ReactNode
    badge?: string
    optional?: boolean
}

export function CollapsibleSection({ icon, title, expanded, onToggle, children, badge, optional = false }: CollapsibleSectionProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-rule transition-all">
            <UnstyledButton type="button" onClick={onToggle} className={`w-full flex items-center gap-3 p-4 hover:bg-sunk/50 transition-colors ${expanded ? "rounded-t-xl" : "rounded-xl"}`}>
                <div className={`p-1.5 rounded-lg ${badge ? "bg-success-sunk text-success" : "bg-primary/10 text-primary"}`}>{icon}</div>
                <span className="font-bold text-ink text-sm flex-1 text-left">{title}</span>
                {optional && <span className="text-xs font-medium text-ink-3 bg-sunk px-2 py-0.5 rounded-xs">Opcional</span>}
                {badge && <span className="text-xs font-bold text-success bg-success-sunk w-6 h-6 rounded-full flex items-center justify-center">{badge}</span>}
                <svg className={`w-4 h-4 text-ink-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </UnstyledButton>
            {expanded && <div className="px-4 pb-5 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">{children}</div>}
        </div>
    )
}
