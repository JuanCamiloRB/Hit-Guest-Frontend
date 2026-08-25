import type { StatusTone } from "@/components/ui/status-pill"
import {
    hasIdentityImages,
    type GuestIdentityDocument,
    type IdentityCapturedBy,
} from "../lib/identity-document"

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

export interface IdentityMethodMeta {
    label: string
    tone: StatusTone
}

/**
 * Pastilla del método de verificación.
 *
 * `null` = no se muestra pastilla. Sin método conocido, al lado ya hay un
 * `StatusPill` que dice si la identidad está verificada; agregar «Sin
 * verificación registrada» repetiría ese estado con otras palabras.
 *
 * El OTP va en `idle` y no en `info` a propósito: es un código al correo que
 * prueba posesión del contacto, no una verificación documental hecha en esta
 * estancia. Pintarlo igual que Didit haría leer «documento verificado» donde no
 * lo hubo.
 */
export function describeIdentityMethod(doc: GuestIdentityDocument): IdentityMethodMeta | null {
    if (doc.method === "didit") return { label: "Verificado con Didit", tone: "info" }
    if (doc.method === "textract-ocr") return { label: "Verificado con IA de HIT", tone: "info" }
    if (doc.method === "otp") return { label: "Reverificado por código", tone: "idle" }
    return null
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
        const method = describeIdentityMethod(doc)
        return method
            ? `${method.label}; el proveedor conserva la evidencia y no expone las imágenes.`
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
