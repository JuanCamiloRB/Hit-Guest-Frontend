/**
 * Valor total de la reserva declarado por el huésped principal — contrato
 * 2026-09-27 (Airbnb iCal, skill `hitguest-api-contracts` §2f-bis).
 *
 * El backend exige un NÚMERO JSON con punto decimal y máximo dos decimales.
 * El huésped escribe como escribe: `850.000,50` en español, `850,000.50` en
 * inglés, o `850000.5` a secas. Acá se traduce lo escrito a ese número, y la
 * pantalla muestra SIEMPRE cómo se interpretó («Vas a declarar: …») para que
 * una ambigüedad de separadores se vea antes de enviarla, no en el 422 ni en
 * el reporte al Ministerio.
 *
 * El análisis devuelve una RAZÓN discriminada cuando falla, no solo `null`:
 * el mensaje al huésped se decide con ella, sin volver a inspeccionar la
 * entrada (eso producía «debe declararse en COP» ante «COP 500 COP»).
 */

import { formatMoney } from "@/lib/money"

export type DeclaredPriceFailure =
    | "empty"
    /** No cumple la gramática: letras dentro del número, separadores ambiguos, más de un símbolo… */
    | "invalid_format"
    /** Dos códigos ISO (aunque coincidan): la moneda se indica una vez o ninguna. */
    | "duplicate_currency"
    /** Un símbolo o código nombra una moneda distinta de la de la reserva. */
    | "currency_mismatch"
    /** Cero, negativo o más de dos decimales. */
    | "out_of_range"

export type DeclaredPriceAnalysis =
    | { ok: true; value: number }
    | { ok: false; reason: DeclaredPriceFailure }

/**
 * Gramática de la entrada: opcionalmente UN símbolo (`$`, `US$`, `€`, `£`) o UN
 * código ISO al inicio, el número, y opcionalmente UN código ISO al final.
 * Cualquier otro carácter hace inválida la entrada — se rechaza, no se limpia:
 * limpiar convertía «85O000» en 85000 y «1e3» en 13.
 *
 * TODOS los indicadores de moneda presentes se recogen y cada uno tiene que
 * ser la moneda de la reserva: «€500 COP» en COP es una contradicción aunque
 * el código coincida, y «€500 EUR» en EUR es válido. `$` es ambiguo (pesos,
 * dólares) y no cuenta como indicador: lo resuelve el preview.
 */
const GRAMMAR = /^(?:(US\$|[$€£])|([A-Za-z]{3}))?\s*(\d[\d.,]*)\s*([A-Za-z]{3})?$/
const SYMBOL_CURRENCY: Record<string, string | null> = { "US$": "USD", "€": "EUR", "£": "GBP", "$": null }

function extractNumberText(raw: string, expectedCurrency: string | null): { number: string } | { reason: DeclaredPriceFailure } {
    const match = GRAMMAR.exec(raw.trim())
    if (!match) return { reason: "invalid_format" }
    const [, symbol, prefixCode, number, suffixCode] = match
    if (prefixCode && suffixCode) return { reason: "duplicate_currency" }

    const indicators = [
        symbol ? SYMBOL_CURRENCY[symbol] : null,
        prefixCode?.toUpperCase() ?? null,
        suffixCode?.toUpperCase() ?? null,
    ].filter((code): code is string => code !== null)
    const expected = expectedCurrency?.toUpperCase() ?? null
    if (indicators.some((code) => code !== expected)) return { reason: "currency_mismatch" }
    return { number }
}

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
 * Reglas de separadores, en este orden:
 *  - Los dos presentes: el que aparece de último es el decimal (una sola vez,
 *    1–2 dígitos); el otro tiene que agrupar miles de a 3.
 *  - Uno solo: si va una vez seguido de 1–2 dígitos, es decimal; si agrupa
 *    miles de a 3 (primer grupo de 1–3), son miles; cualquier otra cosa es
 *    inválido — nunca se adivina.
 */
export function analyzeDeclaredPrice(raw: string, expectedCurrency: string | null): DeclaredPriceAnalysis {
    if (raw.trim() === "") return { ok: false, reason: "empty" }
    const extracted = extractNumberText(raw, expectedCurrency)
    if ("reason" in extracted) return { ok: false, reason: extracted.reason }
    const text = extracted.number

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

    if (!split || !/^\d+$/.test(split.integer)) return { ok: false, reason: "invalid_format" }
    const value = Number(split.fraction ? `${split.integer}.${split.fraction}` : split.integer)
    return Number.isFinite(value) && value > 0 ? { ok: true, value } : { ok: false, reason: "out_of_range" }
}

/** El número, o `null` si la entrada no es válida por cualquier razón. */
export function parseDeclaredPrice(raw: string, expectedCurrency: string | null): number | null {
    const analysis = analyzeDeclaredPrice(raw, expectedCurrency)
    return analysis.ok ? analysis.value : null
}

const FORMAT_HINT = "Escribe un valor mayor que 0, con máximo dos decimales. Por ejemplo: 850.000 o 850.000,50."

/** Mensaje de validación en cliente; `null` cuando el valor es válido. */
export function declaredPriceError(raw: string, expectedCurrency: string | null): string | null {
    const analysis = analyzeDeclaredPrice(raw, expectedCurrency)
    if (analysis.ok) return null
    switch (analysis.reason) {
        case "empty":
            return "Indícanos el valor total de tu reserva."
        case "duplicate_currency":
            return "Indica la moneda una sola vez, o escribe solo el número."
        case "currency_mismatch":
            return expectedCurrency
                ? `El valor debe declararse en ${expectedCurrency}, la moneda de tu reserva.`
                : "Escribe solo el número, sin moneda."
        case "invalid_format":
        case "out_of_range":
            return FORMAT_HINT
    }
}

/**
 * Cómo se va a leer el valor, con la moneda de la reserva a la vista. La
 * moneda sale de `reservation.currency`, nunca se fija en código: Airbnb le
 * muestra al huésped extranjero el total en SU moneda, y un número sin moneda
 * termina reportado al Ministerio como si fueran pesos.
 */
export function formatDeclaredPrice(amount: number, currency: string | null): string {
    return formatMoney(amount, currency)
}

/** «peso colombiano» para COP; el código cuando Intl no lo conoce. */
export function describeCurrency(currency: string | null): string | null {
    if (!currency) return null
    try {
        return new Intl.DisplayNames("es", { type: "currency" }).of(currency) ?? currency
    } catch {
        return currency
    }
}
