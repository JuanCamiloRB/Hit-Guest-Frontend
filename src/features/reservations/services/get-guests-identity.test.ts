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

import { isVerifiedGuestStatus, reservationsService } from "./reservations-service"

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

/**
 * Contrato 2026-09-15 (§4.3): cuando el endpoint del PM trae el bloque
 * `verification` por huésped, es autosuficiente y la ficha DEJA de consultar el
 * portal. Es el cambio de ruta principal de esta feature, y lo que estos tests
 * fijan es justamente lo que el fallback legacy no puede demostrar.
 */
describe("getGuests — panel-first cuando el backend trae `verification`", () => {
    /** Fila del panel con el contrato nuevo completo. */
    function panelGuest(overrides: Record<string, unknown> = {}) {
        return {
            guestProfile: { uuid: GUEST_UUID, name: "Juan Camilo", lastname: "Rodríguez" },
            isMainGuest: true,
            isCompleted: false,
            verification: {
                status: "rejected",
                currentStep: "rejected",
                verifiedAt: null,
                sessionType: "kyc",
                isStale: false,
                canRetry: false,
                attemptsRemaining: 0,
                failureReason: "document_unreadable",
            },
            identityWaiver: null,
            identityDocument: {
                images: { front: "https://api/front", back: null },
                imageFailures: {
                    front: null,
                    back: { flow: "didit", reason: "download failed with HTTP 403", at: "2026-09-08T20:00:00Z" },
                },
                method: "didit",
                capturedBy: "didit",
                inheritedFromAnotherReservation: false,
            },
            ...overrides,
        }
    }

    it("NO consulta el portal, y mapea estado, señales e imágenes desde el panel (QA 12)", async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal("fetch", fetchSpy)
        apiGet.mockResolvedValue({ data: [panelGuest()] })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        // La razón de ser del cambio: una sola fuente, una sola llamada.
        expect(fetchSpy).not.toHaveBeenCalled()
        expect(apiGet).toHaveBeenCalledTimes(1)
        // QA 12: el estado por huésped se lee sin abrir el portal.
        expect(guest.verificationStatus).toBe("rejected")
        expect(guest.verificationSignals).toMatchObject({
            reported: true,
            status: "rejected",
            canRetry: false,
            attemptsRemaining: 0,
            failureReason: "document_unreadable",
        })
        expect(guest.documentImage1).toBe("https://api/front")
        expect(guest.identityDocument.imageFailures.back).toMatchObject({ flow: "didit" })
        expect(guest.identityWaiver).toBeNull()
    })

    it("mapea la exoneración vigente y no la promueve a verificado (QA 3 en el panel)", async () => {
        vi.stubGlobal("fetch", vi.fn())
        apiGet.mockResolvedValue({
            data: [panelGuest({
                verification: { status: "waived", currentStep: "form", canRetry: false, attemptsRemaining: 0 },
                identityWaiver: {
                    uuid: "w-1",
                    status: "active",
                    reason: "Documento ilegible; identidad confirmada en persona.",
                    grantedAt: "2026-09-08T20:14:33.000000Z",
                    grantedBy: "Ricardo Lombana",
                },
            })],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(guest.verificationStatus).toBe("waived")
        expect(isVerifiedGuestStatus(guest.verificationStatus)).toBe(false)
        expect(guest.identityWaiver).toEqual({
            uuid: "w-1",
            reason: "Documento ilegible; identidad confirmada en persona.",
            grantedAt: "2026-09-08T20:14:33.000000Z",
            grantedBy: "Ricardo Lombana",
        })
    })

    it("varios huéspedes conservan cada uno SU estado, sin contagiarse entre filas", async () => {
        vi.stubGlobal("fetch", vi.fn())
        apiGet.mockResolvedValue({
            data: [
                panelGuest(),
                panelGuest({
                    guestProfile: { uuid: "guest-uuid-2", name: "Ana", lastname: "Pérez" },
                    isMainGuest: false,
                    isCompleted: true,
                    verification: { status: "approved", currentStep: "completed", verifiedAt: "2026-09-10T10:00:00Z" },
                    identityWaiver: null,
                }),
                panelGuest({
                    guestProfile: { uuid: "guest-uuid-3", name: "Luis", lastname: "Gómez" },
                    isMainGuest: false,
                    verification: { status: "pending", currentStep: "verification", isStale: true },
                    identityWaiver: { uuid: "w-3", status: "active", reason: null, grantedAt: null, grantedBy: "Dueño" },
                }),
            ],
        })

        const guests = await reservationsService.getGuests(RESERVATION)

        expect(guests.map(g => g.verificationStatus)).toEqual(["rejected", "approved", "pending"])
        expect(guests.map(g => g.uuid)).toEqual([GUEST_UUID, "guest-uuid-2", "guest-uuid-3"])
        expect(guests[0].identityWaiver).toBeNull()
        expect(guests[1].verifiedAt).toBe("2026-09-10T10:00:00Z")
        // El waiver de staff llega sin motivo: se conserva la exoneración, no el texto.
        expect(guests[2].identityWaiver).toMatchObject({ uuid: "w-3", reason: null })
        expect(guests[2].verificationSignals.isStale).toBe(true)
    })

    it("un backend SIN el bloque `verification` vuelve al portal (tolerancia al orden de deploy)", async () => {
        const fetchSpy = vi.fn().mockResolvedValue(portalResponse([portalGuest()]))
        vi.stubGlobal("fetch", fetchSpy)
        apiGet.mockResolvedValue({
            data: [pmGuest({ images: { front: "https://api/front" }, method: "didit" })],
        })

        const [guest] = await reservationsService.getGuests(RESERVATION)

        expect(fetchSpy).toHaveBeenCalled()
        expect(guest.verificationStatus).toBe("approved")
        // Sin señales no se ofrece ninguna acción nueva: los endpoints tampoco existen.
        expect(guest.verificationSignals.reported).toBe(false)
        expect(guest.identityWaiver).toBeNull()
    })
})
