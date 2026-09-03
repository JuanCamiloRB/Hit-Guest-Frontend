"use client"

import { SearchableSelect } from "./SearchableSelect"
import { DateField } from "./DateField"

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
            {/* Segmentado (DD/MM/AAAA), no `type="date"`: el calendario nativo de
                iOS era el punto de fricción número uno del check-in — una fecha
                de nacimiento se teclea, no se navega. */}
            <DateField
                label="Fecha de nacimiento"
                required
                value={dateOfBirth}
                onChange={onDateOfBirthChange}
                max={new Date().toISOString().split("T")[0]}
                autoCompleteKind="bday"
            />
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
