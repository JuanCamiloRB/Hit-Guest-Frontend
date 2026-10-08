/**
 * Captura de documento sin verificación — contrato 2026-09-27 §2.2.
 *
 * `DOCUMENT_NOT_DETECTED` señala en `failedFields` QUÉ LADO no muestra un
 * documento (`front` / `back`). Solo se limpia el lado señalado: obligar a
 * repetir las dos fotos por una sola mala es fricción que el contrato no pide.
 * La forma de `failedFields` ya llega unificada desde el servicio
 * (`normalizeFailedFields`), así que acá solo se leen los lados.
 */

import type { CheckinFailedField } from "./checkin-error"

export type DocumentSide = "front" | "back"

export function readFailedSides(failedFields: readonly CheckinFailedField[] | undefined): DocumentSide[] {
    const sides = new Set<DocumentSide>()
    for (const { field } of failedFields ?? []) {
        if (field === "front" || field === "back") sides.add(field)
    }
    return [...sides]
}

const SIDE_LABEL: Record<DocumentSide, string> = { front: "del frente", back: "del reverso" }

export function describeUndetectedSides(sides: DocumentSide[]): string {
    const where = sides.length === 1 ? ` ${SIDE_LABEL[sides[0]]}` : ""
    return `No detectamos un documento en la foto${where}. Toma otra con el documento completo y bien iluminado.`
}
