/**
 * Qué documentos de la propiedad le corresponden a ESTA reserva.
 *
 * `GET /checkin/{uuid}` devuelve en `documents[]` los documentos ACTIVOS de la
 * PROPIEDAD (`Agreement | Rules | Instructions | Privacy Policy`). Con un
 * contrato por canal hay varios `Agreement`, y el huésped veía cuatro
 * «Contrato» iguales (reporte 2026-10-14). El de la reserva lo elige el backend
 * (`ContractSignatureResolver`) y es el único que acepta `/main/sign`
 * (referencia §13); lo expone `contract/preview` como `agreement.uuid` (§5).
 *
 * Tres resultados distintos, que NO se colapsan (auditoría 2026-10-14):
 * - `selected`: el backend dijo cuál es → se muestra solo ese contrato.
 * - `none`: la reserva no tiene contrato que firmar (sin contrato digital, o
 *   `guarantee_only` con `agreement: null`) → ningún `Agreement` es suyo.
 * - `unknown`: no se pudo saber (p. ej. `contract/preview` da 422 en una
 *   reserva ya cerrada) → tampoco se muestran: cualquiera de ellos podría ser
 *   el contrato de otro canal, y mostrarlos fue exactamente el bug.
 *
 * Los documentos que no son contratos se muestran siempre. Y si ya existe el
 * contrato FIRMADO (`signedContractUrl`), la pantalla lo ofrece aparte: la
 * copia sin firma no se lista, para no ofrecer dos versiones del mismo contrato.
 */

export type ContractDocumentResolution =
    | { kind: "selected"; uuid: string }
    | { kind: "none" }
    | { kind: "unknown" }

interface DocumentLike {
    uuid: string
    type?: string | null
    isContract?: boolean
}

/** Contrato de la propiedad: lo marca `isContract` (backends nuevos) o el tipo `Agreement`. */
export function isAgreementDocument(doc: DocumentLike): boolean {
    return doc.isContract === true || doc.type === "Agreement"
}

export function selectReservationDocuments<T extends DocumentLike>(
    documents: readonly T[],
    contract: ContractDocumentResolution,
    options: { signedContractAvailable: boolean },
): T[] {
    const seen = new Set<string>()
    const unique = documents.filter((doc) => {
        if (seen.has(doc.uuid)) return false
        seen.add(doc.uuid)
        return true
    })
    const shownAgreement = !options.signedContractAvailable && contract.kind === "selected" ? contract.uuid : null
    return unique.filter((doc) => !isAgreementDocument(doc) || doc.uuid === shownAgreement)
}
