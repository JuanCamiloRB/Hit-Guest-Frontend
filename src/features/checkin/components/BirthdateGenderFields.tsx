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
 *
 * Una sola columna en móvil: a dos columnas la etiqueta "Fecha de nacimiento"
 * no entra en el ancho disponible, se parte en dos líneas y se cruza con
 * "Género" —que no se parte— dejando los dos campos desalineados y el valor de
 * género truncado ("Homb..."). A partir de `md` vuelven a convivir, y ahí
 * `items-end` los mantiene sobre la misma línea base. La fecha se topa en hoy.
 */
export function BirthdateGenderFields({
    genderOptions,
    dateOfBirth,
    onDateOfBirthChange,
    gender,
    onGenderChange,
}: Props) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:items-end">
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
