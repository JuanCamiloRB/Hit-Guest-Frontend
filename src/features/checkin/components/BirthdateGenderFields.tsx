"use client"

import { SearchableSelect } from "./SearchableSelect"

interface Props {
    genderOptions: { id: number; label: string }[]
    dateOfBirth: string
    onDateOfBirthChange: (value: string) => void
    gender: number | ""
    onGenderChange: (value: number) => void
}

/**
 * Shared "Fecha de nacimiento" + "Género" row used by both guest forms.
 * `items-end` keeps both inputs on the same baseline even when the birth-date
 * label wraps to two lines and "Género" doesn't. The date is capped at today.
 */
export function BirthdateGenderFields({
    genderOptions,
    dateOfBirth,
    onDateOfBirthChange,
    gender,
    onGenderChange,
}: Props) {
    return (
        <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 leading-tight block">
                    Fecha de nacimiento<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                    type="date"
                    value={dateOfBirth}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => onDateOfBirthChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                />
            </div>
            <div className="space-y-1.5">
                <SearchableSelect
                    label="Género"
                    options={genderOptions}
                    value={gender}
                    onChange={onGenderChange}
                    placeholder="Seleccionar"
                />
            </div>
        </div>
    )
}
