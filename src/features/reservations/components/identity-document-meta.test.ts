import { describe, it, expect } from "vitest"
import { EMPTY_IDENTITY_DOCUMENT, type GuestIdentityDocument } from "../lib/identity-document"
import { AUTOMATION_DEFINITIONS } from "@/features/properties/data/automation-definitions"
import {
    describeDocumentOrigin,
    describeIdentityStatus,
    describeImageError,
    describeMissingImages,
    formatCapturedAt,
} from "./identity-document-meta"

function doc(overrides: Partial<GuestIdentityDocument> = {}): GuestIdentityDocument {
    return { ...EMPTY_IDENTITY_DOCUMENT, ...overrides }
}

describe("describeIdentityStatus", () => {
    it("el tipo de verificación es un atributo del estado, no una etiqueta aparte", () => {
        expect(describeIdentityStatus(doc({ method: "didit" }), "approved"))
            .toEqual({ label: "Identidad verificada · avanzada", tone: "success" })
        expect(describeIdentityStatus(doc({ method: "textract-ocr" }), "approved").label)
            .toBe("Identidad verificada · esencial")
    })

    /**
     * El nombre lo elige el PM al configurar la propiedad. Si esto tuviera su
     * propio diccionario, un rename allá dejaría esta pantalla con el nombre
     * viejo — que es exactamente lo que pasó con "Verificado con Didit".
     */
    it("toma el nombre de las definiciones de Propiedades, sin un segundo diccionario", () => {
        const opcion = AUTOMATION_DEFINITIONS
            .find((d) => d.id === "identity-verification-main")!
            .providerOptions.find((o) => o.value === "didit")!

        expect(describeIdentityStatus(doc({ method: "didit" }), "approved").label)
            .toBe(`Identidad verificada · ${opcion.shortLabel}`)
    })

    it("nunca le nombra al PM un proveedor que él no configuró", () => {
        for (const method of ["didit", "textract-ocr", "otp"] as const) {
            expect(describeIdentityStatus(doc({ method }), "approved").label)
                .not.toMatch(/didit|textract|ocr/i)
        }
    })

    /**
     * El recurrente probó posesión del correo; la foto que se ve la capturó otro
     * flujo en otra estancia. Llamarlo "avanzada" leyendo `capturedBy` afirmaría
     * un reconocimiento facial que en esta reserva no ocurrió.
     */
    it("el OTP no se presenta como una verificación documental", () => {
        expect(describeIdentityStatus(doc({ method: "otp", capturedBy: "didit" }), "approved").label)
            .toBe("Identidad verificada · por código")
    })

    it("sin método reportado afirma solo el estado, sin inventar un tipo", () => {
        // Combinación observada en producción: verificado y `method: null`.
        expect(describeIdentityStatus(doc(), "approved").label).toBe("Identidad verificada")
    })

    it("con la verificación no superada describe el estado y calla el tipo", () => {
        // Un `method` presente con la verificación rechazada describe un intento,
        // no un resultado.
        expect(describeIdentityStatus(doc({ method: "didit" }), "rejected"))
            .toEqual({ label: "Verificación con incidencia", tone: "warning" })
        expect(describeIdentityStatus(doc({ method: "didit" }), "in_review").label)
            .toBe("Identidad en revisión")
        expect(describeIdentityStatus(doc({ method: "didit" }), "in_progress").label)
            .toBe("Verificación en proceso")
        expect(describeIdentityStatus(doc(), "not_started").label).toBe("Identidad pendiente")
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
        expect(copy).toContain("Verificación avanzada")
        expect(copy).toContain("conserva la evidencia")
        expect(copy).not.toMatch(/didit/i)
    })

    it("no le atribuye evidencia retenida al OTP, que no verifica documento", () => {
        expect(describeMissingImages(doc({ isReported: true, method: "otp" }), true))
            .toBe("Sin imágenes de documento para esta reserva.")
    })

    it("no explica un éxito que todavía no ocurrió", () => {
        // Con la identidad sin superar, "el proveedor conserva la evidencia"
        // afirmaría un resultado que no hay.
        expect(describeMissingImages(doc({ isReported: true, method: "didit" }), false))
            .toBe("Sin imágenes de documento para esta reserva.")
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
