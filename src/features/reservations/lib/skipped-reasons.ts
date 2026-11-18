/**
 * Motivos documentados de una ejecución omitida (`responsePayload.reason` con
 * `skipped: true`). Un solo mapa cerrado: PDF (§ skill) + envío del link por
 * WhatsApp (§8) y por la OTA (§13.6). Ninguno se cobra. Un motivo desconocido
 * cae al texto genérico — nunca se muestra el código crudo.
 */
export const SKIPPED_REASON_COPY: Readonly<Record<string, string>> = {
    no_recipients: "No se envió: no hay destinatarios configurados.",
    no_whatsapp_phone: "No se envió por WhatsApp: la reserva no tiene un teléfono utilizable.",
    whatsapp_not_configured: "No se envió por WhatsApp: el canal todavía no está habilitado en HIT.",
    not_imported_from_pms: "No se publicó en la OTA: la reserva no vino de Kunas ni Calry.",
    pms_integration_unavailable: "No se publicó en la OTA: la integración con el PMS no está activa.",
    kunas_messaging_not_configured: "No se publicó en la OTA: la mensajería de Kunas todavía no está habilitada en HIT.",
    calry_not_configured: "No se publicó en la OTA: la conexión con Calry todavía no está habilitada en HIT.",
    no_ota_thread: "No se publicó en la OTA: la reserva no tiene conversación en la OTA.",
    already_posted: "No se volvió a publicar: el mensaje ya estaba en la OTA.",
}

/** «la reserva no tiene un teléfono utilizable»: el motivo sin el «No se envió por …:» del historial. */
export function skippedReasonShort(reason: string | null | undefined): string | null {
    if (!reason || !Object.hasOwn(SKIPPED_REASON_COPY, reason)) return null
    const text = SKIPPED_REASON_COPY[reason]
    const cut = text.indexOf(": ")
    return (cut >= 0 ? text.slice(cut + 2) : text).replace(/\.$/, "")
}
