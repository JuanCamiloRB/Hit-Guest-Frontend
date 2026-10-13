"use client"

import { SearchableSelect } from "./SearchableSelect"
import { DateField } from "./DateField"
import { localDateValue } from "../lib/date-field"

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
 * Dos columnas solo cuando el FORMULARIO tiene ancho para la fecha
 * segmentada (~270 px: DD + MM + AAAA y separadores). Se decide con una
 * consulta de contenedor, no con el ancho de la pantalla: con `md:` un
 * computador ponía las dos columnas dentro de la tarjeta angosta del check-in
 * (`max-w-lg`) y el año quedaba cortado («199»). `@xl` (576 px) deja ~282 px
 * por columna; por debajo, una sola columna, que además evita que «Fecha de
 * nacimiento» se parta y desalinee «Género» en móvil. La fecha se topa en hoy.
 */
export function BirthdateGenderFields({
    genderOptions,
    dateOfBirth,
    onDateOfBirthChange,
    gender,
    onGenderChange,
}: Props) {
    return (
        <div className="@container">
            <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3 @xl:items-end">
                {/* Segmentado (DD/MM/AAAA), no `type="date"`: el calendario nativo de
                    iOS era el punto de fricción número uno del check-in — una fecha
                    de nacimiento se teclea, no se navega. */}
                <DateField
                    label="Fecha de nacimiento"
                    required
                    value={dateOfBirth}
                    onChange={onDateOfBirthChange}
                    max={localDateValue()}
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
        </div>
    )
}
