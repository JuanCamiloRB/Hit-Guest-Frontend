import type { StatusTone } from "@/components/ui/status-pill"
import { providerLabel, providerShortLabel } from "@/features/properties/lib/provider-labels"
import {
    hasIdentityImages,
    type GuestIdentityDocument,
    type IdentityCapturedBy,
    type IdentityMethod,
} from "../lib/identity-document"
import {
    isVerifiedGuestStatus,
    type ReservationGuestVerificationStatus,
} from "../services/reservations-service"

/**
 * Cómo se le cuenta al PM de dónde salió el documento que está mirando.
 *
 * Vive en `components/` y no en `lib/` siguiendo el precedente del repo
 * (`automation-status-meta.ts`, `automation-cell-meta.ts`): `lib/` no habla
 * vocabulario de UI —`guest-name.ts` devuelve `undefined` y deja el copy a quien
 * llama—, así que el servicio nunca termina importando texto de producto.
 *
 * Lo que estas funciones resuelven es real, no cosmético: un documento puede ser
 * de OTRA estancia, y hoy eso es invisible en la pantalla.
 */

export interface IdentityStatusMeta {
    label: string
    tone: StatusTone
}

/**
 * A qué opción de Propiedades corresponde cada método que manda el portal.
 *
 * Escrito como `Record<IdentityMethod, …>` a propósito: si el backend agrega un
 * método al contrato, TypeScript obliga a decidir acá cómo se llama, en vez de
 * dejarlo caer en silencio a «sin tipo».
 *
 * Los slugs NO cruzan solos: Propiedades usa `textract` y el portal manda
 * `textract-ocr` (`canonicalSlug` solo cambia guiones por guiones bajos, así que
 * daría `textract_ocr` y no encontraría nada).
 *
 * `otp` no mapea a ninguno, y eso es el contrato, no un hueco: no es un
 * proveedor que el PM configure, es el camino del huésped recurrente.
 */
const PROVIDER_SLUG_BY_METHOD: Record<IdentityMethod, string | null> = {
    didit: "didit",
    "textract-ocr": "textract",
    otp: null,
}

/**
 * El OTP se nombra acá y no en Propiedades porque no es una opción que el PM
 * pueda elegir: es lo que ocurre cuando el huésped ya se verificó antes.
 */
const OTP_TYPE_LABEL = "por código"

/**
 * El tipo de verificación **en el vocabulario del PM** («avanzada»,
 * «esencial»), listo para componerse dentro de otra frase.
 *
 * Sale de `provider-labels.ts`, que lo deriva de las mismas definiciones que
 * pintan el selector de la propiedad: acá no se escribe «avanzada» ni
 * «esencial», así que un rename en Propiedades llega solo.
 *
 * `null` = el backend no dijo con qué se verificó (combinación observada en
 * producción). Sin dato no se compone nada: el estado se muestra a secas.
 */
function describeVerificationType(doc: GuestIdentityDocument): string | null {
    if (!doc.method) return null
    if (doc.method === "otp") return OTP_TYPE_LABEL
    return providerShortLabel(PROVIDER_SLUG_BY_METHOD[doc.method])
}

/**
 * La ÚNICA pastilla de identidad de la ficha.
 *
 * El tipo de verificación es un **atributo** del estado, no una etiqueta
 * paralela: antes convivían «Verificado con Didit» y «Identidad verificada», dos
 * pastillas para un mismo hecho, y encima la primera le nombraba al PM un
 * proveedor que nunca vio.
 *
 * Sin verificación superada no se compone ningún tipo: un `method` presente con
 * la verificación rechazada describe un intento, no un resultado.
 */
export function describeIdentityStatus(
    doc: GuestIdentityDocument,
    status: ReservationGuestVerificationStatus,
): IdentityStatusMeta {
    if (!isVerifiedGuestStatus(status)) {
        return { label: verificationPendingLabel(status), tone: "warning" }
    }
    const type = describeVerificationType(doc)
    return {
        label: type ? `Identidad verificada · ${type}` : "Identidad verificada",
        tone: "success",
    }
}

/**
 * Qué decir mientras la identidad no está superada. Distingue los estados que
 * el PM puede accionar (una incidencia se atiende; una verificación en curso se
 * espera) del «todavía no empezó».
 */
export function verificationPendingLabel(status: ReservationGuestVerificationStatus): string {
    if (status === "in_review") return "Identidad en revisión"
    if (status === "in_progress" || status === "pending") return "Verificación en proceso"
    if (status === "rejected" || status === "fail" || status === "expired") {
        return "Verificación con incidencia"
    }
    return "Identidad pendiente"
}

function capturedByLabel(capturedBy: IdentityCapturedBy | null): string | null {
    if (capturedBy === "didit") return "Didit"
    if (capturedBy === "textract-ocr") return "la IA de HIT"
    return null
}

/**
 * Fecha de captura, **sin hora**.
 *
 * `capturedAt` llega como `"Y-m-d H:i:s"` sin zona horaria, y
 * `new Date("2026-08-14 12:00:00")` se interpreta como hora LOCAL: mostrar la
 * hora daría un valor desplazado y con toda la pinta de ser correcto. La fecha
 * sola no tiene ese problema y es lo que el PM necesita.
 */
export function formatCapturedAt(value: string | null): string | null {
    if (!value) return null
    const [datePart] = value.split(" ")
    const [year, month, day] = datePart.split("-").map(Number)
    if (!year || !month || !day) return null
    const date = new Date(year, month - 1, day)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date)
}

/**
 * Aviso de procedencia, o `null` cuando no hay nada que advertir.
 *
 * Con `esta-estancia` no se pinta nada: es el caso normal y no merece tinta.
 * Con `desconocido` sí se avisa, porque el PM no debe asumir que la foto se tomó
 * en esta reserva.
 *
 * ## Por qué el aviso repite cómo se verificó, si ya hay una pastilla que lo dice
 *
 * Este texto se lee **dentro del modal de la imagen**, y ahí la pastilla del
 * método queda detrás del overlay. Sin la segunda frase, el PM abre la foto,
 * lee «capturada en una estancia anterior» y se queda sin la contraparte —que el
 * huésped **sí** probó ser él en ESTA reserva—, que es justo la pregunta que ese
 * aviso le despierta. Es el texto que pide el documento del backend del
 * 2026-08-17 (§4, «Aviso de documento heredado»).
 */
export function describeDocumentOrigin(doc: GuestIdentityDocument): string | null {
    if (!hasIdentityImages(doc)) return null

    if (doc.origin === "otra-estancia") {
        const captured = capturedByLabel(doc.capturedBy)
        const fecha = formatCapturedAt(doc.capturedAt)
        const detalle = [
            captured ? `mediante ${captured}` : null,
            fecha ? `el ${fecha}` : null,
        ].filter(Boolean).join(" ")
        const procedencia = detalle
            ? `Documento capturado en una estancia anterior ${detalle}.`
            : "Documento capturado en una estancia anterior."
        // Solo el OTP necesita esta aclaración: es el único método en que la foto
        // que se ve NO la tomó la verificación de esta reserva.
        return doc.method === "otp"
            ? `${procedencia} Este huésped confirmó su identidad en esta reserva con un código enviado a su correo.`
            : procedencia
    }

    if (doc.origin === "desconocido") {
        return "Documento de una verificación previa. No se pudo determinar en qué reserva se capturó."
    }

    return null
}

/**
 * Copy del estado vacío. Que no haya imágenes no es un error: puede ser un
 * huésped que apenas se identificó, uno con la verificación en curso, o uno
 * verificado por un proveedor que conserva la evidencia de su lado.
 */
export function describeMissingImages(
    doc: GuestIdentityDocument,
    isIdentityVerified: boolean,
): string {
    // El backend respondió y dijo que no hay imágenes: se puede ser específico.
    if (doc.isReported) {
        // Dos condiciones, y las dos hacen falta:
        //  - la identidad tiene que estar SUPERADA, porque "el proveedor conserva
        //    la evidencia" explica un éxito; con la verificación en revisión o
        //    rechazada, esa frase afirmaría un resultado que todavía no hay;
        //  - tiene que haber un proveedor, porque el OTP no verifica documento en
        //    esta reserva y atribuirle evidencia retenida sería inventar el motivo.
        const provider = isIdentityVerified && doc.method ? PROVIDER_SLUG_BY_METHOD[doc.method] : null
        const label = provider ? providerLabel(provider) : null
        return label
            ? `${label}: el proveedor conserva la evidencia y no expone las imágenes.`
            : "Sin imágenes de documento para esta reserva."
    }
    // No se pudo preguntar: no afirmar nada sobre el documento.
    return isIdentityVerified
        ? "Identidad verificada; imágenes no disponibles"
        : "Documentos aún no disponibles"
}

/** Copy del fallo de UNA imagen. `httpStatus` indefinido = fallo de red. */
export function describeImageError(httpStatus?: number): { short: string; detail: string } {
    if (httpStatus === 404) {
        return { short: "No disponible", detail: "El backend no tiene esta cara del documento." }
    }
    if (httpStatus === 401) {
        return { short: "Sesión expirada", detail: "Vuelve a iniciar sesión para ver los documentos." }
    }
    if (httpStatus === 403) {
        return { short: "Sin permiso", detail: "No tienes permiso para acceder a este recurso." }
    }
    return { short: "No se pudo cargar", detail: "No se pudo cargar la imagen." }
}
