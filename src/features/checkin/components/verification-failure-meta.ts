/**
 * Copy de los fallos de verificación, indexado por el `failureReason` del
 * contrato 2026-09-02 (in_review reintentable). El backend emite códigos
 * estables; el texto es nuestro — misma división que `identity-document-meta`.
 *
 * Cubre TAMBIÉN los motivos legacy (`ocr_rejected`, `fail`, `expired`,
 * `rejected`) que el reconciliador sigue produciendo con un backend anterior:
 * un solo diccionario, no dos mundos de mensajes.
 */

const FAILURE_COPY: Record<string, string> = {
    // Códigos del contrato nuevo (§7 del documento de backend, 2026-09-02).
    document_image_quality:
        "La foto de tu documento salió borrosa o mal iluminada. Vuelve a intentarlo apoyando el "
        + "documento sobre una superficie plana, con buena luz y sin reflejos.",
    face_match_not_computed:
        "No pudimos comparar tu rostro con la foto del documento. Asegúrate de que la foto del "
        + "documento muestre la cara completa y sin brillos.",
    face_match_failed:
        "La selfie no coincide con la foto de tu documento. Tómate una nueva selfie de frente, "
        + "con buena luz y sin gafas ni gorra.",
    document_not_approved:
        "No pudimos validar tu documento. Verifica que sea un documento vigente y que se vea "
        + "completo en la foto.",
    manual_review:
        "No pudimos completar tu verificación automáticamente. Por favor repite el proceso.",
    // Motivos legacy del reconciliador (backend anterior o rechazo de OCR).
    ocr_rejected: "No pudimos leer bien tu documento. Intenta de nuevo con fotos más claras y buena luz.",
    expired: "Tu documento está vencido.",
    fail: "La verificación no pudo completarse. Intenta de nuevo.",
}

/**
 * Mensaje del fallo. Un código que no conocemos (el catálogo del backend puede
 * crecer) cae al genérico según si hay reintento — nunca se muestra el código
 * crudo al huésped.
 */
export function describeVerificationFailure(
    failureReason: string | undefined,
    retryable: boolean,
): string {
    const known = failureReason ? FAILURE_COPY[failureReason] : undefined
    if (known) return known
    return retryable
        ? "No completaste la verificación. Vuelve a intentarlo."
        : "La verificación fue rechazada. Contacta al anfitrión si necesitas ayuda."
}

/**
 * Aviso de intentos restantes. Solo cuando el margen ya aprieta (≤ 2, regla del
 * documento de backend) y aún queda alguno — con 0 el backend manda
 * `canRetry: false` y el aviso sobraría junto al fallo definitivo. El máximo lo
 * define el backend: acá nunca se nombra el 3.
 */
export function attemptsRemainingNotice(attemptsRemaining: number | undefined): string | null {
    if (attemptsRemaining === undefined || attemptsRemaining <= 0 || attemptsRemaining > 2) return null
    return attemptsRemaining === 1
        ? "Te queda 1 intento."
        : `Te quedan ${attemptsRemaining} intentos.`
}
