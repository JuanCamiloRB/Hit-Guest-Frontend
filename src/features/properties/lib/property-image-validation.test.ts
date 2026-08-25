import { describe, it, expect } from "vitest"
import {
    getFileExtension,
    getImageRejectionReason,
    validatePropertyImages,
    ALLOWED_IMAGE_ACCEPT,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_IMAGE_FORMATS_LABEL,
    type ImageUploadLimits,
} from "./property-image-validation"

const LIMITS: ImageUploadLimits = { maxPerUpload: 10, maxBytes: 5 * 1024 * 1024 }

/** `size` es de sólo lectura en File, así que se define explícitamente. */
function makeFile(name: string, type: string, size = 1024): File {
    const file = new File(["x"], name, { type })
    Object.defineProperty(file, "size", { value: size })
    return file
}

describe("getFileExtension", () => {
    it("devuelve la última extensión en minúsculas", () => {
        expect(getFileExtension("foto.JPG")).toBe("jpg")
        expect(getFileExtension("mi.foto.final.PNG")).toBe("png")
    })

    it("devuelve vacío cuando no hay extensión que leer", () => {
        expect(getFileExtension("foto")).toBe("")
        expect(getFileExtension("foto.")).toBe("")
        // Un dotfile no tiene extensión: tiene nombre oculto.
        expect(getFileExtension(".gitignore")).toBe("")
        expect(getFileExtension("")).toBe("")
    })
})

describe("getImageRejectionReason", () => {
    it("acepta los cuatro formatos que fijó el backend", () => {
        for (const ext of ALLOWED_IMAGE_EXTENSIONS) {
            const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`
            expect(getImageRejectionReason(makeFile(`foto.${ext}`, mime), LIMITS)).toBeNull()
        }
    })

    it("rechaza AVIF — el caso que motivó todo esto", () => {
        // El front aceptaba `image/*`, así que este archivo se subía y el 422
        // llegaba del backend después de esperar la carga.
        expect(getImageRejectionReason(makeFile("didier.avif", "image/avif"), LIMITS))
            .toBe("extension")
    })

    it("rechaza los demás formatos de imagen que `image/*` dejaba pasar", () => {
        expect(getImageRejectionReason(makeFile("a.heic", "image/heic"), LIMITS)).toBe("extension")
        expect(getImageRejectionReason(makeFile("a.gif", "image/gif"), LIMITS)).toBe("extension")
        expect(getImageRejectionReason(makeFile("a.svg", "image/svg+xml"), LIMITS)).toBe("extension")
        expect(getImageRejectionReason(makeFile("a.bmp", "image/bmp"), LIMITS)).toBe("extension")
    })

    describe("el MIME que el navegador a veces no sabe", () => {
        it("acepta un archivo válido cuyo `type` viene vacío", () => {
            // `file.type` depende del registro MIME del SO. Rechazar por esto
            // dejaría a un PM sin poder subir una foto perfectamente válida —
            // peor que el 422 que se intenta evitar.
            expect(getImageRejectionReason(makeFile("foto.jpg", ""), LIMITS)).toBeNull()
            expect(getImageRejectionReason(makeFile("foto.webp", ""), LIMITS)).toBeNull()
        })

        it("tolera el `image/jpg` no estándar que emiten algunos sistemas", () => {
            expect(getImageRejectionReason(makeFile("foto.jpg", "image/jpg"), LIMITS)).toBeNull()
        })

        it("atrapa el AVIF renombrado a .jpg, que la extensión no puede ver", () => {
            // El backend valida por contenido: esto lo rechazaría igual. Detectarlo
            // acá evita la subida inútil.
            expect(getImageRejectionReason(makeFile("didier.jpg", "image/avif"), LIMITS))
                .toBe("content")
        })

        it("atrapa un archivo que ni siquiera es imagen bajo extensión válida", () => {
            expect(getImageRejectionReason(makeFile("factura.png", "application/pdf"), LIMITS))
                .toBe("content")
        })
    })

    it("comprueba el tamaño después del formato", () => {
        // No tiene sentido hablar del peso de un archivo que igual no se puede subir.
        const huge = 6 * 1024 * 1024
        expect(getImageRejectionReason(makeFile("foto.jpg", "image/jpeg", huge), LIMITS)).toBe("size")
        expect(getImageRejectionReason(makeFile("foto.avif", "image/avif", huge), LIMITS)).toBe("extension")
    })

    it("acepta un archivo justo en el límite de tamaño", () => {
        expect(getImageRejectionReason(makeFile("foto.jpg", "image/jpeg", LIMITS.maxBytes), LIMITS))
            .toBeNull()
    })
})

describe("validatePropertyImages", () => {
    it("no reporta nada con una selección válida", () => {
        expect(validatePropertyImages(
            [makeFile("a.jpg", "image/jpeg"), makeFile("b.webp", "image/webp")],
            LIMITS,
        )).toBeNull()
    })

    it("no reporta nada con una selección vacía", () => {
        expect(validatePropertyImages([], LIMITS)).toBeNull()
    })

    it("el límite de cantidad gana sobre los problemas por archivo", () => {
        // Decirle "esta foto pesa mucho" a quien además eligió 20 es empezar por
        // lo menor.
        const files = Array.from({ length: 11 }, (_, i) => makeFile(`a${i}.avif`, "image/avif"))
        const failure = validatePropertyImages(files, LIMITS)
        expect(failure?.title).toBe("Demasiadas fotos")
        expect(failure?.description).toContain("11")
    })

    it("nombra el archivo culpable y los formatos permitidos", () => {
        // Es lo que faltaba: el 422 del backend no decía qué SÍ se puede usar.
        const failure = validatePropertyImages([makeFile("didier.avif", "image/avif")], LIMITS)
        expect(failure?.title).toBe("No se pudo subir una foto")
        expect(failure?.description).toContain('"didier.avif"')
        expect(failure?.description).toContain(ALLOWED_IMAGE_FORMATS_LABEL)
    })

    it("agrupa TODOS los archivos afectados en un solo mensaje", () => {
        // Informar de a uno obliga al PM a reintentar por cada foto para
        // descubrir lo mismo.
        const failure = validatePropertyImages([
            makeFile("ok.jpg", "image/jpeg"),
            makeFile("uno.avif", "image/avif"),
            makeFile("dos.heic", "image/heic"),
        ], LIMITS)
        expect(failure?.title).toBe("No se pudieron subir 2 fotos")
        expect(failure?.description).toContain('"uno.avif"')
        expect(failure?.description).toContain('"dos.heic"')
    })

    it("aconseja convertir, no renombrar, cuando la extensión ya era correcta", () => {
        // "Cambia la extensión" es justo lo que ya hizo quien renombró el .avif.
        const failure = validatePropertyImages([makeFile("didier.jpg", "image/avif")], LIMITS)
        expect(failure?.description).toMatch(/convierte/i)
        expect(failure?.description).not.toMatch(/formato no permitido/i)
    })

    it("separa en líneas los motivos distintos", () => {
        const failure = validatePropertyImages([
            makeFile("uno.avif", "image/avif"),
            makeFile("dos.jpg", "image/jpeg", 9 * 1024 * 1024),
        ], LIMITS)
        const lines = failure!.description.split("\n")
        expect(lines).toHaveLength(2)
        expect(lines[0]).toContain("uno.avif")
        expect(lines[1]).toContain("dos.jpg")
        expect(lines[1]).toContain("5 MB")
    })
})

describe("ALLOWED_IMAGE_ACCEPT", () => {
    it("ofrece extensiones y MIME types al selector de archivos", () => {
        // macOS filtra bien por extensión; algunos navegadores sólo por MIME.
        expect(ALLOWED_IMAGE_ACCEPT).toContain(".webp")
        expect(ALLOWED_IMAGE_ACCEPT).toContain("image/webp")
        expect(ALLOWED_IMAGE_ACCEPT).not.toContain("image/*")
    })

    it("no ofrece ninguno de los formatos que el backend rechaza", () => {
        for (const banned of ["avif", "heic", "gif", "svg", "bmp", "tiff"]) {
            expect(ALLOWED_IMAGE_ACCEPT).not.toContain(banned)
        }
    })
})
