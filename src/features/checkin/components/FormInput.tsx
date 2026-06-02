"use client"

import * as React from "react"

interface FormInputProps {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    required?: boolean
}

export function FormInput({ label, value, onChange, placeholder, type = "text", required = false }: FormInputProps) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" placeholder={placeholder} />
        </div>
    )
}
