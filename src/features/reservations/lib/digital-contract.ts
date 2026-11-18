/**
 * `extra.digitalContract` de una reserva: qué se firmó, con quién y cuándo, o
 * que no se emitió. Forma OBSERVADA en `GET /reservations` (2026-11-19), no
 * documentada salvo `requestedAt`: se lee como `unknown` y un tipo de contrato
 * desconocido queda en `null` (se dice «Contrato» a secas, nunca un tipo
 * inventado).
 *
 * Módulo sin dependencias a propósito: lo usa el servicio de reservas al mapear
 * la lista, que no debe cargar nada de la tabla para leer un campo.
 */

export type DigitalContractType = "agreement_only" | "guarantee_only" | "agreement_and_guarantee"

export interface DigitalContractSummary {
    status: string | null
    provider: string | null
    contractType: DigitalContractType | null
    signedAt: string | null
    requestedAt: string | null
    /** El contrato no se emitió (`notIssued`). */
    notIssued: { reason: string | null } | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function readText(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key]
        if (typeof value === "string" && value.trim() !== "") return value.trim()
    }
    return null
}

const CONTRACT_TYPES = new Set<string>(["agreement_only", "guarantee_only", "agreement_and_guarantee"])

export function readDigitalContract(extra: unknown): DigitalContractSummary | null {
    const record = asRecord(asRecord(extra)?.digitalContract)
    if (!record) return null
    const notIssued = asRecord(record.notIssued)
    const type = readText(record, "contractType", "contract_type")
    return {
        status: readText(record, "status"),
        provider: readText(record, "provider"),
        contractType: type && CONTRACT_TYPES.has(type) ? type as DigitalContractType : null,
        signedAt: readText(record, "signedAt", "signed_at"),
        requestedAt: readText(record, "requestedAt", "requested_at"),
        notIssued: notIssued ? { reason: readText(notIssued, "reason") } : null,
    }
}
