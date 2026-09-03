"use client"

import { useRef, useState } from "react"
import {
    acceptSegmentInput,
    composeDateValue,
    dateFieldError,
    splitDateValue,
    type DateSegments,
} from "../lib/date-field"

interface DateFieldProps {
    label: string
    required?: boolean
    /** `YYYY-MM-DD` o `""` — el mismo valor que emitía el `<input type="date">`. */
    value: string
    onChange: (value: string) => void
    /** Tope superior en `YYYY-MM-DD` (nacimiento: hoy). */
    max?: string
    /** `"bday"` activa el autocompletado de fecha de nacimiento del navegador. */
    autoCompleteKind?: "bday"
}

const SEGMENTS = [
    { key: "day", label: "Día", placeholder: "DD", width: "w-16", bday: "bday-day" },
    { key: "month", label: "Mes", placeholder: "MM", width: "w-16", bday: "bday-month" },
    { key: "year", label: "Año", placeholder: "AAAA", width: "w-24", bday: "bday-year" },
] as const

/**
 * Fecha conocida = fecha que se TECLEA, no que se navega.
 *
 * Reemplaza a los `<input type="date">` del portal: en iOS abrían el calendario
 * nativo, y llegar a una fecha de nacimiento exigía retroceder cientos de meses
 * o descubrir el selector de año escondido — ~10% de los huéspedes no lo
 * lograba (Didier, 2026-09-04). Tres casillas numéricas con auto-avance: el
 * teclado numérico se abre solo y `5 1 2 1 9 8 3` completa 05/12/1983.
 *
 * Emite el mismo `YYYY-MM-DD` de siempre (o `""` mientras esté incompleta o no
 * sea una fecha real), así que ni el payload ni el prefill del OCR cambian.
 */
export function DateField({ label, required, value, onChange, max, autoCompleteKind }: DateFieldProps) {
    const [segments, setSegments] = useState<DateSegments>(() => splitDateValue(value))
    const dayRef = useRef<HTMLInputElement>(null)
    const monthRef = useRef<HTMLInputElement>(null)
    const yearRef = useRef<HTMLInputElement>(null)
    const refs = { day: dayRef, month: monthRef, year: yearRef }

    // Rehidrata desde el padre (prefill del OCR que llega tras el montaje) sin
    // pisar lo que el huésped está tipeando: solo cuando el valor externo CAMBIÓ
    // y es una fecha completa distinta de la que estos segmentos ya componen.
    // Reset durante el render (patrón "adjusting state when a prop changes" de
    // React), no en un efecto: sin render intermedio con el valor viejo.
    const [lastValue, setLastValue] = useState(value)
    if (value !== lastValue) {
        setLastValue(value)
        if (value && value !== composeDateValue(segments)) {
            const incoming = splitDateValue(value)
            if (incoming.year) setSegments(incoming)
        }
    }

    const emit = (next: DateSegments) => {
        setSegments(next)
        const composed = composeDateValue(next)
        // Una fecha que viola el tope no viaja al formulario: se avisa abajo y
        // el submit queda bloqueado igual que con la fecha incompleta.
        onChange(max && composed > max ? "" : composed)
    }

    const handleInput = (key: keyof DateSegments, raw: string) => {
        const { value: accepted, advance } = acceptSegmentInput(key, raw)
        emit({ ...segments, [key]: accepted })
        if (advance) {
            if (key === "day") monthRef.current?.focus()
            if (key === "month") yearRef.current?.focus()
        }
    }

    /** Borrar en un segmento vacío devuelve el foco al anterior, como en un solo campo. */
    const handleKeyDown = (key: keyof DateSegments, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Backspace" || segments[key] !== "") return
        if (key === "year") monthRef.current?.focus()
        if (key === "month") dayRef.current?.focus()
    }

    const error = dateFieldError(segments, max)

    return (
        <fieldset className="space-y-1.5">
            <legend className="text-sm font-semibold text-slate-700 leading-tight">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </legend>
            <div className="flex items-center gap-2">
                {SEGMENTS.map(({ key, label: segLabel, placeholder, width, bday }, index) => (
                    <div key={key} className="flex items-center gap-2">
                        {index > 0 && <span aria-hidden className="text-slate-300 font-semibold">/</span>}
                        <input
                            ref={refs[key]}
                            type="text"
                            inputMode="numeric"
                            aria-label={`${label} — ${segLabel}`}
                            aria-invalid={error ? true : undefined}
                            placeholder={placeholder}
                            autoComplete={autoCompleteKind === "bday" ? bday : "off"}
                            value={segments[key]}
                            onChange={(e) => handleInput(key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(key, e)}
                            className={`${width} bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all`}
                        />
                    </div>
                ))}
            </div>
            {error && (
                <p role="alert" className="text-xs font-medium text-red-600">
                    {error}
                </p>
            )}
        </fieldset>
    )
}
