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
            <label className="text-sm font-semibold text-ink-2">
                {label}
                {required && <span className="text-danger ml-0.5">*</span>}
            </label>
            <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-sunk/50 border border-rule rounded-xl px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" placeholder={placeholder} />
        </div>
    )
}
