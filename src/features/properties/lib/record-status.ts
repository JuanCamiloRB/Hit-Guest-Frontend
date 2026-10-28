/**
 * Estado de una propiedad o un alojamiento (catálogo `status_record`):
 * 6 = activo, 7 = inactivo. Son los ids que escribe el panel
 * (`PropertyCard`, `listing-payload`).
 *
 * Única lectura para decidir si se puede reservar o si desactivar detiene
 * automatizaciones. Hoy el repo mezcla 1/2 y 6/7: 1/2 salían de un catálogo
 * inventado en `PropertyForm` cuando el real no cargaba, no del backend.
 *
 * Un estado ausente o desconocido es `unknown`, nunca «activo»: quien lo use
 * para permitir algo debe tratarlo como no permitido.
 */

export const RECORD_STATUS = { ACTIVE: 6, INACTIVE: 7 } as const

export type RecordStatus = "active" | "inactive" | "unknown"

function fromId(value: unknown): RecordStatus | null {
    const id = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    if (id === RECORD_STATUS.ACTIVE) return "active"
    if (id === RECORD_STATUS.INACTIVE) return "inactive"
    return null
}

function fromLabel(value: unknown): RecordStatus | null {
    if (typeof value !== "string") return null
    const label = value.trim().toUpperCase()
    if (label === "ACTIVE" || label === "ACT") return "active"
    if (label === "INACTIVE" || label === "INA") return "inactive"
    return null
}

/** Lee `statusRecord.id`, `statusRecordId`, `status_record_id` o `status`, en ese orden. */
export function readRecordStatus(raw: unknown): RecordStatus {
    if (typeof raw !== "object" || raw === null) return "unknown"
    const record = raw as Record<string, unknown>
    const nested = typeof record.statusRecord === "object" && record.statusRecord !== null
        ? (record.statusRecord as Record<string, unknown>).id
        : undefined
    return fromId(nested)
        ?? fromId(record.statusRecordId)
        ?? fromId(record.status_record_id)
        ?? fromLabel(record.status)
        ?? "unknown"
}
