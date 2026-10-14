/**
 * Qué documentos de la propiedad le corresponden a ESTA reserva.
 *
 * `GET /checkin/{uuid}` devuelve en `documents[]` documentos de la PROPIEDAD,
 * no solo el de la reserva: con un contrato por canal, una propiedad con cuatro
 * contratos le mostraba cuatro «Contrato» iguales al huésped (reporte
 * 2026-10-14). El contrato de la reserva lo elige el backend
 * (`ContractSignatureResolver`) y es el único que acepta al firmar
 * (`/main/sign` exige ese `document_uuid` exacto, referencia §13); lo expone
 * `contract/preview` como `agreement.uuid` (§5).
 *
 * Regla: de los documentos del MISMO tipo que el contrato elegido se deja solo
 * ese; los de otro tipo se conservan. Sin el contrato elegido, o si no está en
 * la lista, no se oculta nada (solo se quitan repetidos por `uuid`): nunca se
 * esconde un documento por una suposición.
 */
export function selectReservationDocuments<T extends { uuid: string; type?: string | null }>(
    documents: readonly T[],
    contractDocumentUuid: string | null,
): T[] {
    const seen = new Set<string>()
    const unique = documents.filter((doc) => {
        if (seen.has(doc.uuid)) return false
        seen.add(doc.uuid)
        return true
    })
    if (!contractDocumentUuid) return unique
    const chosen = unique.find((doc) => doc.uuid === contractDocumentUuid)
    // Sin tipo no se puede saber cuáles son contratos: no se filtra.
    if (!chosen?.type) return unique
    return unique.filter((doc) => doc.uuid === chosen.uuid || doc.type !== chosen.type)
}
