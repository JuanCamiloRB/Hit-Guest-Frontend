/**
 * Validación de las fotos de una propiedad (POST /properties/{uuid}/images).
 *
 * Existe por un caso real: el front aceptaba `image/*`, así que un `.avif` pasaba
 * la validación, se subía y el backend lo rechazaba con un 422 — el PM se
 * enteraba del formato no soportado DESPUÉS de esperar la carga, y el mensaje no
 * decía qué formatos sí puede usar.
 *
 * La lista de formatos la fijó el backend (jpg, jpeg, png, webp). No se infiere
 * de `image/*` ni se amplía "por si acaso": si mañana el backend agrega uno, se
 * agrega acá y la UI, el `accept` del input y los mensajes lo reflejan solos,
 * porque los tres leen de estas mismas constantes.
 *
 * Lógica pura, sin React: la trampa de esta validación (el MIME que el navegador
 * a veces no sabe) es justo lo que merece pruebas.
 */

/** Extensiones permitidas por el backend. Es lo que ve y entiende el usuario. */
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const

/**
 * MIME types correspondientes.
 *
 * `image/jpg` no es un tipo estándar (el correcto es `image/jpeg`) pero algunos
 * sistemas lo emiten igual. Se acepta para no rechazar un JPG legítimo por una
 * rareza del SO del PM — el backend valida por contenido, no por esta cadena.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
] as const

/** Texto para la UI. Una sola fuente, para que el aviso no se desincronice. */
export const ALLOWED_IMAGE_FORMATS_LABEL = "JPG, JPEG, PNG o WEBP"

/**
 * Valor del atributo `accept` del input.
 *
 * Lleva extensiones Y MIME types a propósito: macOS filtra bien por extensión y
 * algunos navegadores sólo por MIME. Aun así `accept` es una sugerencia al
 * selector de archivos, no una garantía —el usuario puede elegir "todos los
 * archivos" o arrastrar—, así que nunca reemplaza a `validatePropertyImages`.
 */
export const ALLOWED_IMAGE_ACCEPT = [
    ...ALLOWED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`),
    ...ALLOWED_IMAGE_MIME_TYPES,
].join(",")

export interface ImageUploadLimits {
    maxPerUpload: number
    maxBytes: number
}

export interface ImageValidationFailure {
    /** Título corto del toast. */
    title: string
    /** Una línea por problema — mismo formato que usa `notifyError`. */
    description: string
}

/** Última extensión del nombre, en minúsculas y sin punto. `""` si no tiene. */
export function getFileExtension(fileName: string): string {
    const name = String(fileName ?? "").trim()
    const lastDot = name.lastIndexOf(".")
    // `lastDot < 1` cubre tanto "sin punto" como los dotfiles (".gitignore"),
    // que no tienen extensión sino nombre oculto.
    if (lastDot < 1 || lastDot === name.length - 1) return ""
    return name.slice(lastDot + 1).toLowerCase()
}

/** Por qué se rechaza un archivo, o `null` si pasa. */
export type ImageRejectionReason = "extension" | "content" | "size"

/**
 * Evalúa UN archivo.
 *
 * El orden importa y es la razón de que esto no sea un `if` suelto:
 *
 * 1. **Extensión** — es la regla que el usuario entiende y la que el backend
 *    aplica (`mimes:jpg,jpeg,png,webp`). Es el filtro principal.
 * 2. **Contenido (`file.type`)** — sólo se mira SI el navegador lo informa.
 *    `file.type` depende del registro MIME del sistema operativo: un `.jpg`
 *    perfectamente válido puede llegar con `type: ""`. Rechazar por eso dejaría
 *    al PM sin poder subir una foto legítima, que es peor que el 422 que se
 *    intenta evitar. Cuando SÍ viene, atrapa el caso que la extensión no puede:
 *    un `.avif` renombrado a `.jpg`, que el backend rechazaría igual.
 * 3. **Tamaño** — al final: no tiene sentido hablar del peso de un archivo que
 *    de todas formas no se puede subir.
 */
export function getImageRejectionReason(
    file: File,
    limits: ImageUploadLimits,
): ImageRejectionReason | null {
    const extension = getFileExtension(file.name)
    if (!(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
        return "extension"
    }
    if (file.type && !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        return "content"
    }
    if (file.size > limits.maxBytes) {
        return "size"
    }
    return null
}

const formatMegabytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
}

const quoteNames = (files: File[]): string => files.map((f) => `"${f.name}"`).join(", ")

/**
 * Valida la selección completa antes de gastar una subida.
 *
 * Agrupa por motivo y nombra TODOS los archivos afectados: con 8 fotos
 * seleccionadas y 3 en un formato no soportado, informar de a una obliga al PM a
 * reintentar tres veces para descubrir lo mismo.
 */
export function validatePropertyImages(
    files: File[],
    limits: ImageUploadLimits,
): ImageValidationFailure | null {
    if (files.length === 0) return null

    // Va primero porque afecta a la selección entera, no a un archivo: decirle
    // "esta foto pesa mucho" a quien además eligió 20 es empezar por lo menor.
    if (files.length > limits.maxPerUpload) {
        return {
            title: "Demasiadas fotos",
            description:
                `Puedes subir hasta ${limits.maxPerUpload} imágenes por carga; `
                + `seleccionaste ${files.length}.`,
        }
    }

    const byReason = new Map<ImageRejectionReason, File[]>()
    for (const file of files) {
        const reason = getImageRejectionReason(file, limits)
        if (!reason) continue
        const bucket = byReason.get(reason)
        if (bucket) bucket.push(file)
        else byReason.set(reason, [file])
    }
    if (byReason.size === 0) return null

    const lines: string[] = []

    const wrongExtension = byReason.get("extension")
    if (wrongExtension) {
        lines.push(
            `Formato no permitido: ${quoteNames(wrongExtension)}. `
            + `Usa ${ALLOWED_IMAGE_FORMATS_LABEL}.`,
        )
    }

    const wrongContent = byReason.get("content")
    if (wrongContent) {
        // Mensaje distinto a propósito: acá la extensión ya es correcta, así que
        // "cambia la extensión" sería exactamente el consejo equivocado — es lo
        // que ya hizo quien renombró un .avif a .jpg. Hay que convertir el archivo.
        lines.push(
            `El contenido no coincide con la extensión: ${quoteNames(wrongContent)}. `
            + `Convierte el archivo a ${ALLOWED_IMAGE_FORMATS_LABEL} en vez de renombrarlo.`,
        )
    }

    const tooLarge = byReason.get("size")
    if (tooLarge) {
        lines.push(
            `Supera${tooLarge.length > 1 ? "n" : ""} los ${formatMegabytes(limits.maxBytes)}: `
            + `${quoteNames(tooLarge)}.`,
        )
    }

    const affected = [...byReason.values()].reduce((total, list) => total + list.length, 0)
    return {
        title: affected === 1 ? "No se pudo subir una foto" : `No se pudieron subir ${affected} fotos`,
        description: lines.join("\n"),
    }
}
