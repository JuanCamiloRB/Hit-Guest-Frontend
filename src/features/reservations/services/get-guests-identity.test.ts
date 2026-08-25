import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * El cableado de `getGuests`, que es donde vivía el bug.
 *
 * La lectura del contrato ya está cubierta por `lib/identity-document.test.ts`.
 * Lo que se prueba acá es lo otro: que el documento leído del endpoint del PM
 * sobreviva el **merge** con el portal público (que es autoritativo para el
 * estado de verificación pero no trae imágenes), y que un fallo de ese endpoint
 * no borre a los huéspedes de la pantalla.
 */

const apiGet = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api-client", () => ({
    apiClient: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/features/properties/services/properties-service", () => ({
    propertiesService: { list: vi.fn(), getByUuid: vi.fn(), patch: vi.fn() },
}))
vi.mock("@/features/properties/services/listings-service", () => ({
    listingsService: { listByProperty: vi.fn(), getById: vi.fn() },
}))
vi.mock("@/features/properties/services/automation-service", () => ({
    automationService: { getReservationStatus: vi.fn(), listGlobal: vi.fn() },
    canonicalSlug: (value: string) => value,
}))

import { reservationsService } from "./reservations-service"

const RESERVATION = "res-1"
const GUEST_UUID = "guest-uuid-1"

/** La forma real del portal público: sin imágenes, con el estado de verificación. */
function portalResponse(guests: unknown[]) {
    return {
        ok: true,
        json: async () => ({ data: { registeredGuests: guests } }),
    }
}

function portalGuest(overrides: Record<string, unknown> = {}) {
    return {
        uuid: GUEST_UUID,
        name: "Juan Camilo",
        lastname: "Rodríguez",
        isCompleted: true,
        verification: { status: "approved", verifiedAt: "2026-08-14T08:35:01Z" },
        ...overrides,
    }
}

/** La forma real de GET /reservations/{uuid}/guests (verificada 2026-08-18). */
function pmGuest(identityDocument: unknown) {
    return {
        guestProfile: { uuid: GUEST_UUID, name: "Juan Camilo", lastname: "Rodríguez" },
        isMainGuest: true,
        isCompleted: true,
        reservationSpecificData: { contactChallenge: {}, nativeSignature: {} },
        identityDocument,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
})

/**
 * Regla §2d.4 del contrato, preservada acá cuando se eliminó el conteo de
 * verificados de la lista (decisión de producto 2026-08-21): con
 * `status_reservation_id = 30` el backend fuerza `isCompleted: true` en todos
 * los huéspedes SIN tocar `verification`, así que el status explícito manda
 * sobre el flag, y solo un status ausente deja que el completado decida.
 */
describe("getGuests — el check-in forzado no inventa una verificación", () => {
    it("no promueve a verificado un check-in forzado: manda el status explícito", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(portalResponse([
            portalGuest({ isCompleted: true, verification: { status: "pending" } }),
        ])))
        apiGet.mockResolvedValue({ data: [] })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.verificationStatus).toBe("pending")
    })

    it("sin status reconocible, el completado sí alcanza para darlo por verificado", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(portalResponse([
            portalGuest({ isCompleted: true, verification: { status: null } }),
        ])))
        apiGet.mockResolvedValue({ data: [] })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.verificationStatus).toBe("completed")
    })
})

describe("getGuests — el documento del endpoint del PM sobrevive el merge", () => {
    it("lee identityDocument.images y conserva su metadata (el caso del bug)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(portalResponse([portalGuest()])))
        apiGet.mockResolvedValue({
            data: [pmGuest({
                images: { front: "https://api/front", back: null },
                method: "otp",
                capturedBy: "didit",
                capturedAt: "2026-07-02 14:31:08",
                inheritedFromAnotherReservation: true,
            })],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.documentImage1).toBe("https://api/front")
        expect(guest.documentImage2).toBeNull()
        // La metadata solo existe en el endpoint del PM: el portal no la tiene.
        expect(guest.identityDocument.method).toBe("otp")
        expect(guest.identityDocument.capturedBy).toBe("didit")
        expect(guest.identityDocument.origin).toBe("otra-estancia")
        // El portal sigue mandando en el estado de verificación.
        expect(guest.verificationStatus).toBe("approved")
    })

    it("un huésped verificado sin imágenes queda reportado, no como fallo de red", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(portalResponse([portalGuest()])))
        apiGet.mockResolvedValue({
            data: [pmGuest({
                images: { front: null, back: null },
                source: "none",
                method: "didit",
                capturedBy: "didit",
                inheritedFromAnotherReservation: true,
            })],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.documentImage1).toBeNull()
        expect(guest.identityDocument.isReported).toBe(true)
        expect(guest.identityDocument.method).toBe("didit")
    })

    it("si el endpoint del PM falla, los huéspedes siguen saliendo sin metadata inventada", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(portalResponse([portalGuest()])))
        apiGet.mockRejectedValue(new Error("boom"))

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.name).toBe("Juan Camilo")
        // No se pudo preguntar: distinto de "el backend dice que no hay imágenes".
        expect(guest.identityDocument.isReported).toBe(false)
    })

    it("grita cuando el merge deja de cruzar por uuid (fallo silencioso caro)", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            portalResponse([portalGuest({ uuid: "otro-uuid" })]),
        ))
        apiGet.mockResolvedValue({
            data: [pmGuest({ images: { front: "https://api/front" } })],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.documentImage1).toBeNull()
        expect(error).toHaveBeenCalledWith(expect.stringContaining("Ningún huésped del portal cruzó"))
    })
})

describe("getGuests — rama de fallback (portal caído o vacío)", () => {
    it("usa la misma lectura nueva del contrato", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("portal caído")))
        apiGet.mockResolvedValue({
            data: [pmGuest({
                images: { front: "https://api/front", back: "https://api/back" },
                method: "didit",
                capturedBy: "didit",
                inheritedFromAnotherReservation: false,
            })],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.documentImage1).toBe("https://api/front")
        expect(guest.documentImage2).toBe("https://api/back")
        expect(guest.identityDocument.origin).toBe("esta-estancia")
    })

    it("sigue leyendo la clave legacy de una reserva vieja", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("portal caído")))
        apiGet.mockResolvedValue({
            data: [{
                guestProfile: { uuid: GUEST_UUID, name: "Ana", lastname: "Pérez" },
                reservationSpecificData: {
                    documentImages: { front: "https://api/legacy-front", back: null },
                },
            }],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.documentImage1).toBe("https://api/legacy-front")
        expect(guest.identityDocument.isReported).toBe(false)
    })
})
