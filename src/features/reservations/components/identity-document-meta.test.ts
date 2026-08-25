import { describe, it, expect } from "vitest"
import { EMPTY_IDENTITY_DOCUMENT, type GuestIdentityDocument } from "../lib/identity-document"
import {
    describeDocumentOrigin,
    describeIdentityMethod,
    describeImageError,
    describeMissingImages,
    formatCapturedAt,
} from "./identity-document-meta"

function doc(overrides: Partial<GuestIdentityDocument> = {}): GuestIdentityDocument {
    return { ...EMPTY_IDENTITY_DOCUMENT, ...overrides }
}

describe("describeIdentityMethod", () => {
    it("nombra cada método con el lenguaje del producto", () => {
        expect(describeIdentityMethod(doc({ method: "didit" }))?.label).toBe("Verificado con Didit")
        expect(describeIdentityMethod(doc({ method: "textract-ocr" }))?.label).toBe("Verificado con IA de HIT")
        expect(describeIdentityMethod(doc({ method: "otp" }))?.label).toBe("Reverificado por código")
    })

    it("no pinta el OTP como una verificación documental", () => {
        // Un código al correo prueba posesión del contacto, no el documento.
        expect(describeIdentityMethod(doc({ method: "otp" }))?.tone).toBe("idle")
        expect(describeIdentityMethod(doc({ method: "didit" }))?.tone).toBe("info")
    })

    it("sin método no hay pastilla: el StatusPill de al lado ya dice el estado", () => {
        expect(describeIdentityMethod(doc())).toBeNull()
    })
})

describe("formatCapturedAt", () => {
    /**
     * `capturedAt` llega como "Y-m-d H:i:s" SIN zona. Formatearlo con hora daría
     * un valor desplazado según la zona del navegador y con pinta de correcto.
     */
    it("muestra la fecha y nunca la hora", () => {
        const formatted = formatCapturedAt("2026-07-02 14:31:08")
        expect(formatted).toBeTruthy()
        expect(formatted).not.toMatch(/\d{1,2}:\d{2}/)
        expect(formatted).toContain("2026")
    })

    it("no inventa fecha cuando no la hay", () => {
        expect(formatCapturedAt(null)).toBeNull()
        expect(formatCapturedAt("no-es-fecha")).toBeNull()
    })
})

describe("describeDocumentOrigin", () => {
    const conImagen = { front: "https://api/front" }

    it("avisa cuando el documento viene de otra estancia, con quién y cuándo", () => {
        const aviso = describeDocumentOrigin(doc({
            ...conImagen,
            origin: "otra-estancia",
            capturedBy: "didit",
            capturedAt: "2026-07-02 14:31:08",
        }))

        expect(aviso).toContain("estancia anterior")
        expect(aviso).toContain("Didit")
    })

    /**
     * El aviso se lee DENTRO del modal de la imagen, donde la pastilla del
     * método queda detrás del overlay. Sin esta frase el PM ve «documento de
     * otra estancia» y se queda sin saber que el huésped sí probó ser él ahora
     * — el texto que pide §4 del documento de backend del 2026-08-17.
     */
    it("cierra el círculo del recurrente por OTP: la foto es vieja, la identidad de ahora", () => {
        const aviso = describeDocumentOrigin(doc({
            ...conImagen,
            origin: "otra-estancia",
            method: "otp",
            capturedBy: "didit",
            capturedAt: "2026-07-02 14:31:08",
        }))

        expect(aviso).toContain("estancia anterior")
        expect(aviso).toContain("confirmó su identidad en esta reserva")
    })

    it("no agrega esa aclaración cuando la verificación de esta reserva NO fue por código", () => {
        // Con Didit la foto es de la verificación de esta misma reserva: hablar de
        // un código que nunca se envió sería inventar.
        const aviso = describeDocumentOrigin(doc({
            ...conImagen,
            origin: "otra-estancia",
            method: "didit",
            capturedBy: "didit",
        }))

        expect(aviso).not.toContain("código")
    })

    it("avisa que el origen es desconocido en vez de callarlo", () => {
        // `null` no es `false`: el backend dice que no puede determinarlo.
        expect(describeDocumentOrigin(doc({ ...conImagen, origin: "desconocido" })))
            .toContain("No se pudo determinar")
    })

    it("no dice nada cuando el documento es de esta reserva", () => {
        expect(describeDocumentOrigin(doc({ ...conImagen, origin: "esta-estancia" }))).toBeNull()
    })

    it("no avisa de procedencia si no hay imagen que mirar", () => {
        expect(describeDocumentOrigin(doc({ origin: "otra-estancia" }))).toBeNull()
    })

    it("omite la fecha cuando no viene, sin fabricar un fallback", () => {
        const aviso = describeDocumentOrigin(doc({
            ...conImagen,
            origin: "otra-estancia",
            capturedBy: "didit",
            capturedAt: null,
        }))
        expect(aviso).toBe("Documento capturado en una estancia anterior mediante Didit.")
    })
})

describe("describeMissingImages", () => {
    it("explica el caso real: verificado, pero el proveedor guarda la evidencia", () => {
        const copy = describeMissingImages(doc({ isReported: true, method: "didit" }), true)
        expect(copy).toContain("Verificado con Didit")
        expect(copy).toContain("conserva la evidencia")
    })

    it("es concreto cuando el backend respondió sin método conocido", () => {
        expect(describeMissingImages(doc({ isReported: true }), false))
            .toBe("Sin imágenes de documento para esta reserva.")
    })

    it("cuando no se pudo preguntar, no afirma nada sobre el documento", () => {
        // isReported=false es un fallo de red: distinto de "no hay imágenes".
        expect(describeMissingImages(doc(), true)).toBe("Identidad verificada; imágenes no disponibles")
        expect(describeMissingImages(doc(), false)).toBe("Documentos aún no disponibles")
    })
})

describe("describeImageError", () => {
    it("distingue las causas que el PM puede accionar", () => {
        expect(describeImageError(404).short).toBe("No disponible")
        expect(describeImageError(401).short).toBe("Sesión expirada")
        expect(describeImageError(403).short).toBe("Sin permiso")
        expect(describeImageError(500).short).toBe("No se pudo cargar")
        expect(describeImageError().short).toBe("No se pudo cargar")
    })
})
