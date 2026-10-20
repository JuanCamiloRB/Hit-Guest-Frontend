import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/image-upload", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/image-upload")>()
    // La compresión real usa canvas; acá se prueba el flujo, no el algoritmo.
    return { ...actual, prepareImageForUpload: vi.fn(async (file: File) => file) }
})
vi.mock("@/lib/store/auth-store", () => ({ useAuthStore: { getState: () => ({ user: { token: "t-pm" } }) } }))

import { reservationsService } from "./reservations-service"
import { prepareImageForUpload } from "@/lib/image-upload"

const file = (name: string, bytes: number, type = "image/jpeg") => new File([new Uint8Array(bytes)], name, { type })

/** La fila del contrato §2 (respuesta 200 → `guest`). */
const GUEST_ROW = {
    uuid: "g-1",
    isMainGuest: true,
    isCompleted: false,
    guestProfile: { name: "Ana", lastname: "Pérez" },
    identityDocument: {
        images: { front: "https://api/front", back: null },
        method: "pm-upload",
        capturedAt: "2026-10-15 13:42:01",
        uploadedBy: "Laura Gómez",
        source: "reservation",
        inheritedFromAnotherReservation: false,
    },
    identityWaiver: { uuid: "w-1", status: "active", reason: null, grantedAt: "2026-10-15T13:00:00Z", grantedBy: "Didier" },
}

describe("reservationsService.uploadWaivedGuestDocuments", () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => vi.unstubAllGlobals())

    it("manda multipart (sin Content-Type propio), con token e idioma, y devuelve la fila normalizada", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "Se guardaron las fotos del documento del huésped.",
            processing: { front: { outcome: "cropped", rotation: 90 }, back: null },
            guest: GUEST_ROW,
        }), { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)

        const result = await reservationsService.uploadWaivedGuestDocuments("r-1", "g-1", { front: file("f.jpg", 1000), back: null })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/reservations\/r-1\/guests\/g-1\/verification\/waiver\/documents$/)
        expect(init.method).toBe("POST")
        expect(init.body).toBeInstanceOf(FormData)
        expect((init.body as FormData).get("front_image")).toBeInstanceOf(File)
        expect((init.body as FormData).has("back_image")).toBe(false)
        expect(init.headers).toMatchObject({ Authorization: "Bearer t-pm", "X-Locale": expect.any(String) })
        expect(init.headers).not.toHaveProperty("Content-Type")
        expect(prepareImageForUpload).toHaveBeenCalledTimes(1)
        expect(result.guest?.uuid).toBe("g-1")
        expect(result.guest?.identityDocument.method).toBe("pm-upload")
        expect(result.guest?.identityDocument.uploadedBy).toBe("Laura Gómez")
    })

    it("si ni comprimidas caben en el proxy, no envía nada", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)
        await expect(reservationsService.uploadWaivedGuestDocuments("r-1", "g-1", {
            front: file("f.jpg", 3 * 1024 * 1024), back: file("b.jpg", 2 * 1024 * 1024),
        })).rejects.toMatchObject({ status: 413 })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("un 422 del backend llega como ApiError con errorType y failedFields", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            success: false, errorType: "DOCUMENT_NOT_DETECTED", failedFields: ["front"], message: "No hay documento.",
        }), { status: 422 })))
        await expect(reservationsService.uploadWaivedGuestDocuments("r-1", "g-1", { front: file("f.jpg", 10), back: null }))
            .rejects.toMatchObject({ status: 422, errorType: "DOCUMENT_NOT_DETECTED", failedFields: ["front"] })
    })
})
