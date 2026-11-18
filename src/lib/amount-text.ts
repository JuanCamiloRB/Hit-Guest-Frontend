/**
 * De lo que una persona ESCRIBE como importe («650.000», «650,5», «1.234,56»,
 * «1,234.56», «650000») al número que viaja al backend. Un solo criterio para
 * el valor declarado por el huésped (iCal), el precio de la reserva manual y
 * el precio por noche del alojamiento.
 *
 * Reglas de separadores, en este orden:
 *  - Los dos presentes: el que aparece de último es el decimal (una sola vez,
 *    1–2 dígitos); el otro tiene que agrupar miles de a 3.
 *  - Uno solo: si va una vez seguido de 1–2 dígitos, es decimal; si agrupa
 *    miles de a 3 (primer grupo de 1–3), son miles; cualquier otra cosa es
 *    inválido — nunca se adivina.
 *
 * Por qué no `Number(texto)`: `Number("650.000")` es 650. Un PM colombiano
 * que escribe seiscientos cincuenta mil como se escribe en Colombia veía
 * «650.000» en pantalla y la reserva se creaba por 650. La pantalla debe
 * mostrar SIEMPRE cómo se interpretó (`formatMoney`) cuando hay separadores.
 */

const DECIMAL_TAIL = /^\d{1,2}$/
const FIRST_GROUP = /^\d{1,3}$/
const GROUP = /^\d{3}$/

function isThousandsGrouped(integerPart: string, separator: string): boolean {
    const groups = integerPart.split(separator)
    return groups.length >= 2 && FIRST_GROUP.test(groups[0]) && groups.slice(1).every((g) => GROUP.test(g))
}

/** Un solo separador presente: decide si es decimal o de miles. `null` = ambiguo/inválido. */
function splitSingle(text: string, separator: string): { integer: string; fraction: string } | null {
    const parts = text.split(separator)
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && DECIMAL_TAIL.test(parts[1])) {
        return { integer: parts[0], fraction: parts[1] }
    }
    if (isThousandsGrouped(text, separator)) return { integer: parts.join(""), fraction: "" }
    return null
}

/**
 * Parte entera y fracción de un texto hecho solo de dígitos, puntos y comas;
 * `null` si la combinación de separadores no se puede leer sin adivinar.
 */
export function splitAmountText(text: string): { integer: string; fraction: string } | null {
    const lastComma = text.lastIndexOf(",")
    const lastDot = text.lastIndexOf(".")
    let split: { integer: string; fraction: string } | null

    if (lastComma >= 0 && lastDot >= 0) {
        const decimal = lastComma > lastDot ? "," : "."
        const thousands = decimal === "," ? "." : ","
        const parts = text.split(decimal)
        split = parts.length === 2 && DECIMAL_TAIL.test(parts[1]) && isThousandsGrouped(parts[0], thousands)
            ? { integer: parts[0].split(thousands).join(""), fraction: parts[1] }
            : null
    } else if (lastComma >= 0) {
        split = splitSingle(text, ",")
    } else if (lastDot >= 0) {
        split = splitSingle(text, ".")
    } else {
        split = { integer: text, fraction: "" }
    }
    return split && /^\d+$/.test(split.integer) ? split : null
}

/**
 * El número que representa el texto, o `null` si está vacío o no se puede
 * leer sin adivinar. No valida rango: eso lo decide cada formulario.
 */
export function parseAmountText(raw: string): number | null {
    const text = raw.trim()
    if (text === "" || !/^[\d.,]+$/.test(text)) return null
    const split = splitAmountText(text)
    if (!split) return null
    const value = Number(split.fraction ? `${split.integer}.${split.fraction}` : split.integer)
    return Number.isFinite(value) ? value : null
}

/** `true` si el texto trae algún separador: entonces conviene mostrar cómo se leyó. */
export function hasAmountSeparator(raw: string): boolean {
    return /[.,]/.test(raw)
}

/** Ejemplos para el mensaje de error, en la forma que se escribe acá. */
export const AMOUNT_FORMAT_EXAMPLES = "650000, 650.000 o 650.000,50"
