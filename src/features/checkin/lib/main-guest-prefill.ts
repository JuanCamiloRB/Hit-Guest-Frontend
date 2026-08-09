import type { MainGuestPrefill } from "../types/checkin"

/**
 * Datos del TITULAR capturados al crear la reserva (manual o sincronizada),
 * para precargar su check-in y ahorrarle escribir lo que el PM ya registró.
 *
 * Contrato: viajan en `reservation.mainGuestPrefill` de `GET /checkin/{uuid}`.
 * Campo OPCIONAL — mientras el backend no lo mande, todo esto devuelve `null`
 * y el formulario se comporta exactamente como hoy.
 *
 * SOLO aplica al huésped principal: los datos de la reserva son del titular, y
 * usarlos para un acompañante le pondría el correo y el teléfono de otra
 * persona.
 */

/** Lee un string no vacío, o `undefined`. */
function readText(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined
    const trimmed = raw.trim()
    return trimmed === "" ? undefined : trimmed
}

/** Lee un id de catálogo positivo, o `undefined`. */
function readCatalogId(raw: unknown): number | undefined {
    if (raw === null || raw === undefined || raw === "") return undefined
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : undefined
}

/**
 * Normaliza el bloque de precarga que venga en el portal.
 *
 * Nombre y apellido se toman SOLO si llegan separados. La reserva los guarda
 * en un único campo libre (`extra.guestName`, p. ej. "Ricardo L") y partirlo
 * por espacios es indecidible en español: "Ricardo Emilio Lombana Quiñones" no
 * dice cuántos tokens son nombres y cuántos apellidos. Como estos datos
 * alimentan los reportes de SIRE y TRA, un apellido mal partido es peor que un
 * campo vacío: el primero se ve correcto y se envía al gobierno, el segundo lo
 * corrige el huésped antes de continuar.
 */
export function normalizeMainGuestPrefill(raw: unknown): MainGuestPrefill | null {
    if (!raw || typeof raw !== "object") return null
    const source = raw as Record<string, unknown>

    const prefill: MainGuestPrefill = {
        name: readText(source.name ?? source.first_name ?? source.firstName),
        lastname: readText(source.lastname ?? source.last_name ?? source.lastName),
        nationalityId: readCatalogId(source.nationalityId ?? source.nationality_id),
        phone: readText(source.phone ?? source.guestPhone ?? source.guest_phone),
        email: readText(source.email ?? source.emailGuest ?? source.email_guest),
    }

    // Un objeto con todos los campos vacíos no es una precarga.
    const hasAny = Object.values(prefill).some((value) => value !== undefined)
    if (!hasAny) return null

    // Sin apellido no se precarga el nombre: dejaría "Apellidos" vacío junto a
    // un "Nombre" que probablemente contenga el nombre completo.
    if (!prefill.name || !prefill.lastname) {
        prefill.name = undefined
        prefill.lastname = undefined
    }

    return prefill
}

/** Campos del formulario que la precarga puede tocar. */
export type PrefillPatch = Partial<
    Record<"name" | "lastname" | "nationalityId" | "phone" | "email", string | number>
>

interface PrefillOptions {
    /**
     * Incluir teléfono y correo. `false` en el paso de identificación, que
     * ocurre ANTES de verificar identidad: cualquiera con el link llega ahí, y
     * el contacto del titular no debe verse hasta que alguien haya probado
     * posesión del documento.
     */
    includeContact: boolean
    /**
     * El esquema del backend pide `phone`. Cuando no lo pide, el campo ni
     * siquiera se renderiza y el formulario lo limpia, así que precargarlo
     * sería escribir en un campo invisible.
     */
    schemaIncludesPhone?: boolean
}

/**
 * Convierte la precarga en el parche a aplicar sobre el formulario.
 *
 * Devuelve solo las claves con valor: quien lo consume decide la precedencia
 * (esta precarga es la MÁS BAJA — la pisa `prefilledData` del backend y, sobre
 * todo, el OCR del documento, que es el dato autoritativo de identidad).
 */
export function mainGuestPrefillPatch(
    prefill: MainGuestPrefill | null | undefined,
    { includeContact, schemaIncludesPhone = false }: PrefillOptions,
): PrefillPatch {
    if (!prefill) return {}

    const patch: PrefillPatch = {}
    if (prefill.name) patch.name = prefill.name
    if (prefill.lastname) patch.lastname = prefill.lastname
    if (prefill.nationalityId) patch.nationalityId = prefill.nationalityId

    if (includeContact) {
        if (prefill.email) patch.email = prefill.email
        if (prefill.phone && schemaIncludesPhone) patch.phone = prefill.phone
    }

    return patch
}

/**
 * Aplica el parche sin pisar lo que ya tiene valor propio.
 *
 * `defaults` son los valores hardcodeados del formulario (p. ej.
 * `nationalityId: 48`): un campo que sigue en su default no es una elección
 * del huésped, así que la precarga sí puede sustituirlo.
 */
export function applyPrefillPatch<T extends Record<string, unknown>>(
    current: T,
    patch: PrefillPatch,
    defaults: Record<string, unknown> = {},
): T {
    const next = { ...current } as Record<string, unknown>

    for (const [key, value] of Object.entries(patch)) {
        const existing = next[key]
        const isEmpty = existing === "" || existing === null || existing === undefined
        const isAtDefault = key in defaults && existing === defaults[key]
        if (isEmpty || isAtDefault) next[key] = value
    }

    return next as T
}
