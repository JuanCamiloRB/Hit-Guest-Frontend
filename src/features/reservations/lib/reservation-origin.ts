/**
 * Origen técnico de una reserva y rastro de conflictos con el PMS — contrato
 * del 2026-08-24 (skill `hitguest-api-contracts` §2g).
 *
 * Claves de la respuesta: `isImported` (bool), `importSource`
 * (`"calry" | "kunas_pms" | null` — enum ABIERTO: puede crecer con cada
 * integración), `syncedAt` (ISO | null, forward-only), y dentro de `extra`,
 * `overwrittenEdits[]` cuando el webhook del PMS pisó una edición manual.
 *
 * Todo lo de acá es de LECTURA para mostrar: nada gatea acciones destructivas,
 * así que la dirección de fallo es la de un aviso (skill untrusted-network-data
 * §4): el modo "gestionado por el PMS" solo se activa con `isImported === true`
 * EXPLÍCITO — una clave ausente (backend viejo, shape imprevisto) no es noticia
 * y no debe llenar el dashboard de avisos falsos.
 */

export interface ReservationOrigin {
    /**
     * `false` también cuando la clave no vino — por eso existe `originKnown`:
     * afirmar «creada manualmente» exige un `false` EXPLÍCITO del backend, no
     * la ausencia de respuesta (ausente ≠ negado).
     */
    isImported: boolean
    /** `true` solo si el backend respondió la pregunta (`isImported` booleano). */
    originKnown: boolean
    /** Etiqueta legible de la integración; `null` si no vino. */
    importSourceLabel: string | null
    /**
     * ISO de la última vez que el PMS tocó la reserva. `null` = «no sabemos»
     * (forward-only desde 2026-08-24): NUNCA pintarlo como «sin sincronizar».
     */
    syncedAt: string | null
}

/** Slugs conocidos; uno nuevo se muestra tal cual llega, nunca se oculta. */
const IMPORT_SOURCE_LABELS: Record<string, string> = {
    calry: "Calry",
    kunas_pms: "Kunas PMS",
}

export function readReservationOrigin(raw: unknown): ReservationOrigin {
    const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
    const importSource = typeof record.importSource === "string" && record.importSource
        ? record.importSource
        : null
    return {
        isImported: record.isImported === true,
        originKnown: record.isImported === true || record.isImported === false,
        importSourceLabel: importSource ? IMPORT_SOURCE_LABELS[importSource] ?? importSource : null,
        syncedAt: typeof record.syncedAt === "string" && record.syncedAt ? record.syncedAt : null,
    }
}

/**
 * Los 6 campos que el webhook `reservation.updated` puede pisar. Copy única
 * para el aviso del formulario de edición — el resto de campos el PMS nunca
 * los toca (contrato §2g.4).
 */
export const PMS_MANAGED_FIELDS_NOTICE =
    "Fechas, huéspedes, precio, moneda y canal los gestiona el PMS: una sincronización puede revertir los cambios que hagas aquí."

export interface OverwrittenEdit {
    /** Etiqueta legible del campo; un campo desconocido muestra su clave cruda. */
    fieldLabel: string
    /** Strings normalizados por el backend, para MOSTRAR — no para calcular. */
    previous: string
    incoming: string
    /** ISO de cuándo el PMS pisó el valor; `null` si no vino legible. */
    overwrittenAt: string | null
    /** Integración que lo pisó (p. ej. "calry"); `null` si no vino. */
    source: string | null
}

/** `field` llega en snake_case (nombre de columna, no de API) — contrato §2g.4. */
const OVERWRITTEN_FIELD_LABELS: Record<string, string> = {
    arrival_date: "Fecha de llegada",
    departure_date: "Fecha de salida",
    total_guests: "Huéspedes",
    total_price: "Precio total",
    currency: "Moneda",
    reservation_source_id: "Canal",
}

/**
 * Lee `extra.overwrittenEdits` tolerando fila por fila: una entrada malformada
 * se descarta sin tirar la lista (el aviso «el PMS revirtió N cambios» debe
 * sobrevivir aunque una fila venga rara). Una fila sin `field` no es mostrable
 * y se omite; el resto de valores caen a defaults presentables.
 */
export function readOverwrittenEdits(extra: unknown): OverwrittenEdit[] {
    const record = extra && typeof extra === "object" ? extra as Record<string, unknown> : {}
    const rawList = record.overwrittenEdits ?? record.overwritten_edits
    if (!Array.isArray(rawList)) return []

    const edits: OverwrittenEdit[] = []
    for (const raw of rawList) {
        if (!raw || typeof raw !== "object") continue
        const row = raw as Record<string, unknown>
        const field = typeof row.field === "string" ? row.field.trim() : ""
        if (!field) continue
        edits.push({
            fieldLabel: OVERWRITTEN_FIELD_LABELS[field] ?? field,
            previous: typeof row.previous === "string" ? row.previous : String(row.previous ?? "—"),
            incoming: typeof row.incoming === "string" ? row.incoming : String(row.incoming ?? "—"),
            overwrittenAt: typeof row.overwrittenAt === "string" && row.overwrittenAt ? row.overwrittenAt : null,
            source: typeof row.source === "string" && row.source ? row.source : null,
        })
    }
    return edits
}
