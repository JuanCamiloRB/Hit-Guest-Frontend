/**
 * Lógica del campo de fecha segmentado (Día / Mes / Año) del portal.
 *
 * Existe porque el `<input type="date">` nativo era uno de los principales
 * puntos de fricción del check-in (reporte de Didier, 2026-09-04: ~10% de los
 * huéspedes no lograba ingresar una fecha). El calendario es un control para
 * ELEGIR fechas cercanas; las tres fechas del flujo —nacimiento ×2 y
 * vencimiento del documento— son fechas que el huésped ya sabe o está leyendo
 * del documento: se teclean, no se navegan.
 *
 * El valor compuesto es el MISMO `YYYY-MM-DD` que emitía el input nativo: el
 * payload al backend no cambia y el prefill del OCR hidrata igual.
 */

export interface DateSegments {
    day: string
    month: string
    year: string
}

/** `"1983-08-05"` → segmentos; cualquier otra forma → vacíos (nunca lanza). */
export function splitDateValue(value: string | null | undefined): DateSegments {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "")
    if (!match) return { day: "", month: "", year: "" }
    return { year: match[1], month: match[2], day: match[3] }
}

/**
 * `true` solo para una fecha del calendario real: el constructor de `Date`
 * "corrige" un 30 de febrero a marzo en silencio, así que se compara el
 * round-trip en vez de confiar en que no lance.
 */
export function isRealDate(year: number, month: number, day: number): boolean {
    const date = new Date(year, month - 1, day)
    return (
        date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
    )
}

/**
 * Segmentos → `"YYYY-MM-DD"`, o `""` mientras estén incompletos o no formen
 * una fecha real. El límite inferior del año (1900) descarta el error de tipeo
 * obvio sin rechazar a nadie vivo.
 */
export function composeDateValue({ day, month, year }: DateSegments): string {
    if (day.length === 0 || month.length === 0 || year.length !== 4) return ""
    const d = Number(day)
    const m = Number(month)
    const y = Number(year)
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return ""
    if (y < 1900 || !isRealDate(y, m, d)) return ""
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

/**
 * Qué contarle al huésped cuando ya llenó los tres segmentos. `null` = nada que
 * decir (fecha válida, o todavía incompleta — un campo a medias no es un error).
 */
export function dateFieldError(segments: DateSegments, max?: string): string | null {
    const { day, month, year } = segments
    if (day.length === 0 || month.length === 0 || year.length < 4) return null
    const composed = composeDateValue(segments)
    if (!composed) return "Revisa la fecha: ese día no existe en el calendario."
    // Comparación de strings ISO: mismo orden que el cronológico.
    if (max && composed > max) return "La fecha no puede ser futura."
    return null
}

/**
 * Normaliza lo tipeado en un segmento y decide si el foco debe saltar al
 * siguiente. La regla de menor fricción: un primer dígito que no admite
 * segundo ("5" en día, "4" en mes) se completa solo a "05"/"04" y avanza —
 * escribir 5/12/1983 son 7 pulsaciones, sin tocar nada más.
 */
export function acceptSegmentInput(
    segment: "day" | "month" | "year",
    raw: string,
): { value: string; advance: boolean } {
    const digits = raw.replace(/\D/g, "")
    if (segment === "year") {
        const value = digits.slice(0, 4)
        return { value, advance: false }
    }
    const limit = segment === "day" ? 3 : 1
    let value = digits.slice(0, 2)
    // Primer dígito imposible de extender: se auto-completa con cero.
    if (value.length === 1 && Number(value) > limit) value = `0${value}`
    return { value, advance: value.length === 2 }
}
