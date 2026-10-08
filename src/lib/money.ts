/**
 * El ÚNICO formateador de montos con moneda del panel y del portal.
 *
 * Antes cada pantalla armaba el suyo: `$${n} ${currency}` antepone «$» a EUR o
 * GBP, y un `|| "COP"` en el servicio convertía una moneda ausente en pesos
 * sin que nadie lo viera. Acá la moneda es un dato: si falta, se devuelve el
 * número a secas y quien pinta decide cómo avisar — nunca se inventa.
 */

const LOCALE = "es-CO"

function isCurrencyCode(value: string | null | undefined): value is string {
    return typeof value === "string" && /^[A-Z]{3}$/i.test(value.trim())
}

export function formatMoney(amount: number, currency: string | null | undefined): string {
    const options: Intl.NumberFormatOptions = { minimumFractionDigits: 0, maximumFractionDigits: 2 }
    if (isCurrencyCode(currency)) {
        try {
            return new Intl.NumberFormat(LOCALE, { ...options, style: "currency", currency: currency.toUpperCase() }).format(amount)
        } catch {
            // Código con forma válida que Intl no acepta: número + código, sin símbolo inventado.
            return `${amount.toLocaleString(LOCALE, options)} ${currency.toUpperCase()}`
        }
    }
    return amount.toLocaleString(LOCALE, options)
}

/** Código ISO 4217 leído de una respuesta; `null` si no vino o no tiene esa forma. */
export function readCurrencyCode(...candidates: unknown[]): string | null {
    for (const candidate of candidates) {
        if (isCurrencyCode(candidate as string)) return (candidate as string).trim().toUpperCase()
    }
    return null
}
