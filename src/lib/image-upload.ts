/**
 * Fotos que salen del navegador hacia el backend.
 *
 * Todo lo que el navegador manda pasa por el proxy `/api/guest` (una función
 * serverless de Vercel), y Vercel corta el cuerpo de la petición en el borde:
 * medido el 2026-10-08 contra producción, 4,0 MB llegan al backend y 4,3 MB
 * reciben `413 Request Entity Too Large` SIN que el proxy ni el backend vean
 * la llamada (la documentación de Vercel dice 4,5 MB). Tres fotos de un
 * teléfono actual pesan 2–4 MB cada una: la verificación de identidad fallaba
 * con un «Error en la solicitud» que no salía en ningún log.
 *
 * Por eso cada foto se comprime acá antes de salir (una cédula a 1800 px de
 * lado mayor se lee perfectamente en Textract y Rekognition) y el total se
 * compara contra el tope ANTES de enviar. Si el navegador no puede
 * recomprimir (sin canvas, formato que no decodifica), se manda el original y
 * decide el tope — nunca se bloquea una foto por no poder optimizarla.
 */

/** Tope del cuerpo que acepta el proxy. Medido, no documentado: ver arriba. */
export const PROXY_REQUEST_BODY_LIMIT_BYTES = 4 * 1024 * 1024

/** Por encima de esto una foto se recomprime; por debajo viaja intacta. */
export const UPLOAD_IMAGE_TARGET_BYTES = 1024 * 1024

/** Lado mayor tras recomprimir. Suficiente para OCR y comparación de rostro. */
export const UPLOAD_IMAGE_MAX_DIMENSION = 1800

export interface PrepareImageOptions {
    targetBytes?: number
    maxDimension?: number
}

export function totalBytes(files: readonly (File | Blob | null | undefined)[]): number {
    return files.reduce((sum, file) => sum + (file?.size ?? 0), 0)
}

export function exceedsProxyLimit(files: readonly (File | Blob | null | undefined)[]): boolean {
    return totalBytes(files) > PROXY_REQUEST_BODY_LIMIT_BYTES
}

/**
 * Reparte archivos en lotes cuyo total cabe en una petición del proxy, en el
 * orden recibido. Un archivo que por sí solo supera el tope va en su propio
 * lote: quien llama decide si lo manda o lo rechaza (acá no se pierde nada).
 */
export function splitIntoRequestBatches<T extends { size: number }>(
    files: readonly T[],
    limitBytes: number = PROXY_REQUEST_BODY_LIMIT_BYTES,
): T[][] {
    const batches: T[][] = []
    let current: T[] = []
    let currentBytes = 0
    for (const file of files) {
        if (current.length > 0 && currentBytes + file.size > limitBytes) {
            batches.push(current)
            current = []
            currentBytes = 0
        }
        current.push(file)
        currentBytes += file.size
    }
    if (current.length > 0) batches.push(current)
    return batches
}

function canvasAvailable(): boolean {
    if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        return false
    }
    try {
        return document.createElement("canvas").getContext("2d") !== null
    } catch {
        return false
    }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const image = new Image()
        image.onload = () => {
            URL.revokeObjectURL(url)
            resolve(image)
        }
        image.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("image_decode_failed"))
        }
        image.src = url
    })
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
}

function jpegName(name: string): string {
    return name.replace(/\.[^.]+$/, "") + ".jpg"
}

/**
 * Devuelve la foto lista para subir: la misma si ya es pequeña, o una copia
 * JPEG reducida. El navegador aplica la orientación EXIF al decodificar en
 * `<img>` (Chrome 81+, Safari 13.1+, Firefox 77+), así que una foto vertical
 * del teléfono no sale acostada. Baja calidad y luego tamaño hasta entrar en
 * `targetBytes`; si no lo logra, devuelve el mejor intento.
 */
export async function prepareImageForUpload(file: File, options: PrepareImageOptions = {}): Promise<File> {
    const targetBytes = options.targetBytes ?? UPLOAD_IMAGE_TARGET_BYTES
    const maxDimension = options.maxDimension ?? UPLOAD_IMAGE_MAX_DIMENSION
    if (file.size <= targetBytes || !file.type.startsWith("image/") || !canvasAvailable()) return file

    try {
        const image = await loadImage(file)
        const width = image.naturalWidth || image.width
        const height = image.naturalHeight || image.height
        if (!width || !height) return file

        let scale = Math.min(1, maxDimension / Math.max(width, height))
        let best: Blob | null = null

        for (let round = 0; round < 3 && scale > 0.2; round += 1) {
            const canvas = document.createElement("canvas")
            canvas.width = Math.max(1, Math.round(width * scale))
            canvas.height = Math.max(1, Math.round(height * scale))
            const context = canvas.getContext("2d")
            if (!context) return file
            context.drawImage(image, 0, 0, canvas.width, canvas.height)

            for (const quality of [0.85, 0.75, 0.65]) {
                const blob = await encode(canvas, quality)
                if (!blob) return best ? toFile(best, file) : file
                if (!best || blob.size < best.size) best = blob
                if (blob.size <= targetBytes) return toFile(blob, file)
            }
            scale *= 0.7
        }
        return best && best.size < file.size ? toFile(best, file) : file
    } catch {
        return file
    }
}

function toFile(blob: Blob, source: File): File {
    return new File([blob], jpegName(source.name || "photo"), { type: "image/jpeg", lastModified: Date.now() })
}
