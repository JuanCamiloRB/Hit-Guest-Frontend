/**
 * ¿El documento de identidad del huésped ya venció?
 *
 * Existe porque el portal y los endpoints de escritura usan DOS nociones
 * distintas de "verificado" (§A.4 del documento de endpoints):
 *
 *   - El portal reporta `approved` / `currentStep: "form"` mirando solo
 *     `person_verified_at`.
 *   - `/main/complete`, `/main/sign`, `/guarantee/setup-intent` y
 *     `/secondary/complete` exigen además que el documento NO esté vencido.
 *
 * O sea: a un huésped recurrente cuyo documento venció desde su última estadía,
 * el portal le dice que siga al formulario y el backend lo rechaza con un 403
 * "Guest identity has not been verified" recién en el envío final — después de
 * llenar todo, leer el contrato y FIRMAR. El front tiene la fecha desde el
 * principio (llega en `prefilledData` de `/form`, o del OCR), así que puede
 * detenerlo al principio en vez de dejarlo chocar al final.
 *
 * Se compara por día calendario, no por instante: la fecha viene como
 * "YYYY-MM-DD" sin hora ni zona, y `new Date("2026-08-08")` se interpreta como
 * medianoche UTC — en zonas al oeste de Greenwich eso daría por vencido un
 * documento que todavía sirve.
 */

/** Vencido solo si la fecha es ESTRICTAMENTE anterior a hoy: si vence hoy, sirve hoy. */
export function isDocumentExpired(expiryDate: string | null | undefined, today: Date = new Date()): boolean {
    if (!expiryDate) return false // Sin fecha no se puede afirmar que venció.

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expiryDate.trim())
    if (!match) return false // Formato inesperado: no bloquear por algo que no entendemos.

    const [, year, month, day] = match
    const expiry = Date.UTC(Number(year), Number(month) - 1, Number(day))
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())

    return expiry < todayUtc
}
