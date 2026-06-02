"use client"

import * as React from "react"

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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 transition-all">
            <button type="button" onClick={onToggle} className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50/50 transition-colors ${expanded ? "rounded-t-2xl" : "rounded-2xl"}`}>
                <div className={`p-1.5 rounded-lg ${badge ? "bg-green-100 text-green-600" : "bg-brand-purple/10 text-brand-purple"}`}>{icon}</div>
                <span className="font-bold text-slate-800 text-sm flex-1 text-left">{title}</span>
                {optional && <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Opcional</span>}
                {badge && <span className="text-xs font-bold text-green-600 bg-green-100 w-6 h-6 rounded-full flex items-center justify-center">{badge}</span>}
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {expanded && <div className="px-4 pb-5 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">{children}</div>}
        </div>
    )
}
