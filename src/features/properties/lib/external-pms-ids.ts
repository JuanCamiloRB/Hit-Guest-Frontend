/**
 * External PMS identifiers — the `{ origen, id externo }` pair that links a
 * property or a listing created manually in HitGuest with its counterpart in the
 * PMS / channel it really lives in.
 *
 * Backend contract (reescrito por backend el 2026-08-23; skill
 * `hitguest-api-contracts`, sección "Identificadores externos"):
 *   - Request  (POST/PUT/PATCH `/properties`, `/listings`):
 *       `externalPmsIds: [{ id?, sourcePmsId, externalId }]`
 *     · `id` es OBLIGATORIO para editar una fila existente: sin él, el mismo
 *       `sourcePmsId` devuelve 422 `*_source_taken` (el validador de unicidad
 *       solo excluye la fila cuyo `id` venga en el payload). Filas nuevas van
 *       sin `id`.
 *     · `externalPmsIds: []` BORRA todas las filas; la clave OMITIDA no toca
 *       nada. Por eso los formularios solo la envían cuando la sección se editó
 *       (dirty-gating) — serializarla siempre destruía datos.
 *     · `sourcePmsId` debe existir en el catálogo categoría 12 (`source_pms`);
 *       máximo una fila por PMS; `externalId` máx. 60 chars.
 *   - Response: property y listing la devuelven como `pmsIdentifiers`, con `id`
 *     en cada fila (index/show/store/update cargan la relación). Tras cada
 *     guardado se rehidrata el estado desde la respuesta: un cambio de source
 *     borra y recrea la fila, y reutilizar el `id` viejo da 422.
 *   - Errores 422: las claves llegan como `externalIdentifiers.N.campo` (tercer
 *     nombre para lo mismo — deuda declarada del backend), ya localizadas por
 *     `X-Locale`; se muestran tal cual.
 */

import type { ExternalPmsId } from "../types"

/** Catalog category that holds the PMS/channel sources (`source_pms`). */
export const SOURCE_PMS_CATALOG_CATEGORY_ID = 12

/** Backend limit for `externalPmsIds[].externalId`. */
export const EXTERNAL_ID_MAX_LENGTH = 60

/** The keys an API response may carry the identifiers under, most likely first. */
const RESPONSE_KEYS = ["pmsIdentifiers", "externalPmsIds", "external_identifiers"] as const

function toEntry(raw: unknown): ExternalPmsId | null {
    if (!raw || typeof raw !== "object") return null
    const item = raw as Record<string, unknown>
    const sourcePmsId = Number(item.sourcePmsId ?? item.source_pms_id)
    const externalId = String(item.externalId ?? item.external_id ?? "").trim()
    if (!Number.isInteger(sourcePmsId) || sourcePmsId <= 0 || !externalId) return null
    // El `id` de la fila es lo que permite EDITARLA después (422 sin él).
    // Solo se conserva un entero positivo real — un `id` basura reenviado
    // también es un 422, en `externalIdentifiers.N.id`.
    const id = Number(item.id)
    return Number.isInteger(id) && id > 0
        ? { id, sourcePmsId, externalId }
        : { sourcePmsId, externalId }
}

/**
 * Lee los identificadores de una respuesta distinguiendo dos estados que la
 * rehidratación NO puede confundir:
 *   - `[]`   → la respuesta AFIRMA que no hay identificadores (clave presente).
 *   - `null` → la respuesta no trae la clave: "no sabemos", el llamador decide
 *              su fallback en vez de pisar estado real con un vacío inventado.
 */
export function readExternalPmsIds(source: unknown): ExternalPmsId[] | null {
    if (!source || typeof source !== "object") return null
    const record = source as Record<string, unknown>

    for (const key of RESPONSE_KEYS) {
        const value = record[key]
        if (!Array.isArray(value)) continue
        return value.map(toEntry).filter((entry): entry is ExternalPmsId => entry !== null)
    }
    return null
}

/**
 * Reads the external identifiers off a property or listing API response.
 *
 * Drops entries the form could not round-trip anyway (missing source, empty id),
 * so an incomplete row from the API never becomes an invalid payload on save.
 * Returns `[]` for anything unrecognizable — never throws on a shape surprise.
 */
export function normalizeExternalPmsIds(source: unknown): ExternalPmsId[] {
    return readExternalPmsIds(source) ?? []
}

/**
 * True when a row is still missing its source or its id — the state a freshly
 * added row starts in. Both the property form and the unit dialog block saving
 * on this, so the rule lives here once instead of in each of them.
 */
export function hasIncompleteExternalPmsId(rows: ExternalPmsId[] | undefined): boolean {
    return (rows ?? []).some(
        (row) => !row.sourcePmsId || !String(row.externalId ?? "").trim(),
    )
}

/**
 * The payload form: trimmed ids, incomplete rows dropped, and el `id` de cada
 * fila existente reenviado tal cual — filas nuevas van sin él.
 *
 * QUIÉN debe llamar esto lo decide el dirty-gating del formulario: enviar el
 * resultado sin que la sección se haya editado es lo que borraba datos
 * (`[]` = borrar todo desde el contrato del 2026-08-23).
 */
export function toExternalPmsIdsPayload(rows: ExternalPmsId[] | undefined): ExternalPmsId[] {
    return (rows ?? [])
        .filter((row) => row.sourcePmsId && String(row.externalId ?? "").trim())
        .map((row) => ({
            ...(row.id ? { id: row.id } : {}),
            sourcePmsId: Number(row.sourcePmsId),
            externalId: String(row.externalId).trim(),
        }))
}

/**
 * ¿La sección cambió de verdad respecto a lo cargado? Es la condición para
 * incluir `externalPmsIds` en el payload. Compara lo que el payload compararía
 * (filas completas, valores normalizados), en orden — reordenar filas iguales
 * no es un cambio que el backend pueda ver.
 */
export function sameExternalPmsIds(
    a: ExternalPmsId[] | undefined,
    b: ExternalPmsId[] | undefined,
): boolean {
    const key = (rows: ExternalPmsId[] | undefined) =>
        JSON.stringify(
            toExternalPmsIdsPayload(rows)
                .map(({ id, sourcePmsId, externalId }) => [id ?? null, sourcePmsId, externalId])
                .sort((x, y) => Number(x[1]) - Number(y[1])),
        )
    return key(a) === key(b)
}

/** Un error de servidor ya atribuido a una fila y campo del formulario. */
export interface ExternalIdentifierServerError {
    index: number
    /** `sourcePmsId`, `externalId` o `id` — tal como los nombra el validador. */
    field: string
    message: string
}

/**
 * `"externalIdentifiers.0.sourcePmsId"` → `{ index: 0, field: "sourcePmsId" }`.
 * El prefijo del backend no coincide ni con lo que se envía (`externalPmsIds`)
 * ni con lo que se recibe (`pmsIdentifiers`) — deuda #1 declarada del backend.
 */
export function mapExternalIdentifierErrorKey(key: string): { index: number; field: string } | null {
    const match = key.match(/^externalIdentifiers\.(\d+)\.(\w+)$/)
    return match ? { index: Number(match[1]), field: match[2] } : null
}

/**
 * Extrae de un cuerpo de error 422 los errores atribuibles a filas de
 * identificadores. Los mensajes ya vienen localizados por `X-Locale` — se
 * devuelven tal cual, nunca recompuestos en cliente.
 */
export function readExternalIdentifierServerErrors(errors: unknown): ExternalIdentifierServerError[] {
    if (!errors || typeof errors !== "object" || Array.isArray(errors)) return []
    const result: ExternalIdentifierServerError[] = []
    for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
        const mapped = mapExternalIdentifierErrorKey(key)
        if (!mapped) continue
        const message = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")
        if (!message) continue
        result.push({ ...mapped, message })
    }
    return result
}
