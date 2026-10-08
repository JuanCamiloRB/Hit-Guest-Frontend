import { describe, expect, it } from "vitest"
import {
    PROXY_REQUEST_BODY_LIMIT_BYTES,
    exceedsProxyLimit,
    prepareImageForUpload,
    splitIntoRequestBatches,
    totalBytes,
} from "./image-upload"

const MB = 1024 * 1024
const sized = (size: number) => ({ size })

describe("tope del proxy — se decide antes de enviar", () => {
    it("el tope es el medido contra producción (4 MB), no los 4,5 MB documentados", () => {
        expect(PROXY_REQUEST_BODY_LIMIT_BYTES).toBe(4 * MB)
    })

    it("suma lo que viaja y ignora los huecos", () => {
        expect(totalBytes([sized(MB) as File, null, undefined, sized(2 * MB) as File])).toBe(3 * MB)
        expect(exceedsProxyLimit([sized(2 * MB) as File, sized(2 * MB) as File])).toBe(false)
        expect(exceedsProxyLimit([sized(2 * MB) as File, sized(2.1 * MB) as File])).toBe(true)
    })

    it("reparte en lotes que caben, en orden, sin perder ningún archivo", () => {
        const files = [sized(1.5 * MB), sized(1.5 * MB), sized(1.5 * MB), sized(0.5 * MB), sized(5 * MB), sized(0.1 * MB)]
        const batches = splitIntoRequestBatches(files, 4 * MB)
        expect(batches.map((b) => b.length)).toEqual([2, 2, 1, 1])
        // Uno que no cabe solo va en su propio lote: el llamador lo rechaza, acá no se pierde.
        expect(batches[2]).toEqual([sized(5 * MB)])
        expect(batches.flat()).toHaveLength(files.length)
        expect(splitIntoRequestBatches([])).toEqual([])
    })
})

describe("prepareImageForUpload — nunca bloquea una foto", () => {
    it("una foto ya pequeña viaja intacta", async () => {
        const file = new File([new Uint8Array(1024)], "front.jpg", { type: "image/jpeg" })
        expect(await prepareImageForUpload(file)).toBe(file)
    })

    it("sin canvas (este entorno) devuelve el original en vez de fallar", async () => {
        const file = new File([new Uint8Array(2 * MB)], "front.heic", { type: "image/heic" })
        expect(await prepareImageForUpload(file)).toBe(file)
    })
})
