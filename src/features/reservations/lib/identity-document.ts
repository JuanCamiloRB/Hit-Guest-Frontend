/**
 * El documento de identidad de un huésped en el detalle de reserva.
 *
 * ## Por qué existe este archivo
 *
 * El bug que lo motivó no fue «falta leer una clave»: fue que **la misma lectura
 * estaba escrita dos veces** en `reservations-service.ts` (la rama de fallback y
 * el mapa que enriquece al portal), y ninguna de las dos conocía la clave
 * `identityDocument` que el backend publicó el 2026-08-17. Arreglar un solo sitio
 * dejaba el otro roto; copiar la clave nueva a los dos reproducía la causa raíz.
 * Por eso la lectura del contrato vive acá, una sola vez, sin React y sin fetch.
 *
 * Verificado contra producción el 2026-08-18: la clave legacy
 * `reservationSpecificData.documentImages` **no existe** en la respuesta real
 * (ese objeto trae solo `contactChallenge` y `nativeSignature`), así que un
 * huésped con identidad verificada y documento guardado aparecía como
 * «Documentos aún no disponibles», en silencio.
 *
 * Este módulo NO contiene texto de producto: las etiquetas y el copy viven en
 * `components/identity-document-meta.ts`, igual que `guest-name.ts` devuelve
 * `undefined` y deja el fallback a quien llama.
 */

/**
 * De qué estancia salió la foto que se está mostrando.
 *
 * `desconocido` es un estado real del contrato, no un caso de borde: el backend
 * lo devuelve para verificaciones anteriores a que correlacionara verificaciones
 * con reservas. Afirmar «es de esta reserva» ahí sería inventar.
 */
export type IdentityDocumentOrigin = "esta-estancia" | "otra-estancia" | "desconocido"

/** Cómo el huésped superó identidad EN ESTA reserva. */
export type IdentityMethod = "didit" | "textract-ocr" | "otp"

/** Qué flujo capturó la imagen que se ve (puede ser de una estancia anterior). */
export type IdentityCapturedBy = "didit" | "textract-ocr"

export interface GuestIdentityDocument {
    front: string | null
    back: string | null
    /** Cómo superó identidad en ESTA reserva. */
    method: IdentityMethod | null
    /** Qué flujo tomó la foto que se está viendo. Difiere de `method` en el recurrente por OTP. */
    capturedBy: IdentityCapturedBy | null
    /**
     * `"Y-m-d H:i:s"` crudo, **sin zona horaria**.
     *
     * NUNCA formatearlo con hora: `new Date("2026-08-14 12:00:00")` se interpreta
     * como hora LOCAL, así que la hora mostrada saldría desplazada y con pinta de
     * correcta. Se muestra solo la fecha (ver `formatCapturedAt`).
     */
    capturedAt: string | null
    origin: IdentityDocumentOrigin
    /**
     * `true` solo si el backend devolvió el objeto `identityDocument` para este
     * huésped.
     *
     * Separa «el backend dice que no hay imágenes» de «no pudimos preguntar» (el
     * mapa cayó en su `catch`). Sin este bit, un huésped verificado por Didit sin
     * evidencia local y una caída de red producen exactamente la misma pantalla,
     * y son cosas opuestas para el PM. Es el mismo principio que ya justifica
     * `readCount()` en este servicio: `undefined` no es `0`.
     */
    isReported: boolean
}

const METHODS: IdentityMethod[] = ["didit", "textract-ocr", "otp"]
const CAPTURED_BY: IdentityCapturedBy[] = ["didit", "textract-ocr"]

export const EMPTY_IDENTITY_DOCUMENT: GuestIdentityDocument = Object.freeze({
    front: null,
    back: null,
    method: null,
    capturedBy: null,
    capturedAt: null,
    origin: "desconocido",
    isReported: false,
})

function readText(raw: unknown): string | null {
    if (typeof raw !== "string") return null
    const trimmed = raw.trim()
    return trimmed === "" ? null : trimmed
}

/**
 * Un valor solo se acepta si está en la lista del contrato. Un proveedor nuevo
 * del backend degrada a `null` —sin badge— en vez de pintarse crudo al PM.
 */
function readEnum<T extends string>(raw: unknown, allowed: T[]): T | null {
    return typeof raw === "string" && (allowed as string[]).includes(raw) ? (raw as T) : null
}

/**
 * Resuelve la URL de una imagen.
 *
 * Las URLs nuevas son absolutas y se dejan intactas. Las rutas relativas son de
 * reservas viejas guardadas bajo `/storage/`: quitar ese prefijo «porque ahora
 * vienen absolutas» rompería el histórico.
 */
export function resolveDocumentUrl(value: unknown, storageBase: string): string | null {
    const path = readText(value)
    if (!path) return null
    return /^https?:\/\//i.test(path) ? path : `${storageBase}${path}`
}

/**
 * Traduce `inheritedFromAnotherReservation` a los tres estados reales.
 *
 * Solo el booleano explícito decide. Escrito como comparación estricta a
 * propósito: un `!!valor` habría colapsado `null` en `false`, que es exactamente
 * la lectura que el backend pide no hacer.
 */
export function readIdentityOrigin(raw: unknown): IdentityDocumentOrigin {
    if (raw === true) return "otra-estancia"
    if (raw === false) return "esta-estancia"
    return "desconocido"
}

function asRecord(raw: unknown): Record<string, unknown> {
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
}

/**
 * Lee el documento de identidad de UNA entrada cruda de huésped.
 *
 * Precedencia de imágenes; **frente y reverso salen siempre del mismo nivel**,
 * nunca mezclados (serían capturas de estancias distintas):
 *
 * 1. `identityDocument.images` — autoritativa desde 2026-08-17, URLs absolutas
 *    autenticadas. Es la única que trae metadata.
 * 2. `reservationSpecificData.documentImages` — legacy; se conserva hasta que el
 *    backend autorice retirarla (su paso 6).
 * 3. `pivot.extra.document_images` — forma histórica.
 * 4. `documentImage1` / `documentImage2` — la forma que usa el portal público.
 */
export function readIdentityDocument(rawGuest: unknown, storageBase: string): GuestIdentityDocument {
    const guest = asRecord(rawGuest)
    const identity = guest.identityDocument ?? guest.identity_document
    const hasIdentityKey = !!identity && typeof identity === "object"
    const identityRecord = asRecord(identity)
    const identityImages = asRecord(identityRecord.images)

    const reservationSpecific = asRecord(
        guest.reservationSpecificData ?? guest.reservation_specific_data,
    )
    const pivotExtra = asRecord(asRecord(guest.pivot).extra)
    const legacy = asRecord(
        reservationSpecific.documentImages
        ?? reservationSpecific.document_images
        ?? pivotExtra.document_images
        ?? pivotExtra.documentImages,
    )

    const candidates: Array<{ front: unknown; back: unknown }> = [
        { front: identityImages.front, back: identityImages.back },
        { front: legacy.front, back: legacy.back },
        {
            front: guest.documentImage1 ?? guest.document_image_1,
            back: guest.documentImage2 ?? guest.document_image_2,
        },
    ]

    let front: string | null = null
    let back: string | null = null
    for (const candidate of candidates) {
        const resolvedFront = resolveDocumentUrl(candidate.front, storageBase)
        const resolvedBack = resolveDocumentUrl(candidate.back, storageBase)
        if (resolvedFront || resolvedBack) {
            front = resolvedFront
            back = resolvedBack
            break
        }
    }

    return {
        front,
        back,
        method: readEnum(identityRecord.method, METHODS),
        capturedBy: readEnum(identityRecord.capturedBy ?? identityRecord.captured_by, CAPTURED_BY),
        capturedAt: readText(identityRecord.capturedAt ?? identityRecord.captured_at),
        origin: readIdentityOrigin(
            identityRecord.inheritedFromAnotherReservation
            ?? identityRecord.inherited_from_another_reservation,
        ),
        isReported: hasIdentityKey,
    }
}

export function hasIdentityImages(doc: GuestIdentityDocument): boolean {
    return doc.front !== null || doc.back !== null
}

/**
 * Elige UN documento entre dos fuentes (el endpoint del PM y el portal público).
 *
 * Nunca mezcla campo a campo: un frente de una fuente con un reverso de la otra
 * podrían ser capturas de estancias distintas presentadas como un mismo
 * documento. Gana el que tenga imágenes; si empatan, el que traiga metadata.
 */
export function mergeIdentityDocuments(
    primary: GuestIdentityDocument | undefined,
    fallback: GuestIdentityDocument | undefined,
): GuestIdentityDocument {
    if (!primary) return fallback ?? EMPTY_IDENTITY_DOCUMENT
    if (!fallback) return primary
    if (hasIdentityImages(primary)) return primary
    if (hasIdentityImages(fallback)) return fallback
    return primary.isReported ? primary : fallback
}
