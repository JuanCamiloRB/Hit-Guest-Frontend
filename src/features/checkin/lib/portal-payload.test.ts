import { describe, it, expect, vi, afterEach } from "vitest"
import { classifyPortalPayload, assertRenderablePortal } from "./portal-payload"
import type { CheckinPortalResponse } from "../types/checkin"

/**
 * Shape mínimo renderizable, calcado del payload real observado el 2026-08-21
 * para la reserva MANUAL-QK3ZSY (skill `hitguest-api-contracts` §3): claves raíz
 * contract/documents/progress/registeredGuests/reservation, `reservation` sin
 * `reference`. Tipado suelto a propósito: los tests mutan/borran claves para
 * simular payloads que violan el contrato.
 */
type LoosePortal = { reservation: Record<string, unknown> } & Record<string, unknown>

const fullPortal = (): LoosePortal => ({
    reservation: {
        uuid: "01a015e0-3e09-72ef-850a-7cf22bca99b3",
        arrivalDate: "2026-08-24",
        departureDate: "2026-08-26",
        totalGuestsAllowed: 1,
        checkinAllowed: true,
    },
    progress: { registered: 1, completed: 1, isFullyCompleted: true },
    registeredGuests: [],
    documents: [{ uuid: "019ffd7f", type: "Contrato", name: null }],
    contract: { signingProvider: "hitguest_signature", status: "completed" },
})

const asPortal = (portal: LoosePortal) => portal as unknown as CheckinPortalResponse

describe("classifyPortalPayload — el 200 no garantiza el shape", () => {
    it("acepta el payload completo real", () => {
        expect(classifyPortalPayload(fullPortal())).toBe("ready")
    })

    it("acepta el shape mínimo sin claves opcionales (documents/contract ausentes)", () => {
        const portal = fullPortal()
        delete portal.documents
        delete portal.contract
        expect(classifyPortalPayload(portal)).toBe("ready")
    })

    it("clasifica cancelada/eliminada como closed aunque falte todo lo demás (§3)", () => {
        expect(classifyPortalPayload({ portalStatus: "cancelled", message: "Reserva cancelada" }))
            .toBe("closed")
        expect(classifyPortalPayload({ portalStatus: "deleted" })).toBe("closed")
    })

    describe("malformed — cada clave que el render desreferencia", () => {
        it("sin reservation", () => {
            const portal = fullPortal()
            delete (portal as Record<string, unknown>).reservation
            expect(classifyPortalPayload(portal)).toBe("malformed")
        })

        it("reservation sin uuid (res.uuid.slice revienta SuccessScreen)", () => {
            const portal = fullPortal()
            delete portal.reservation.uuid
            expect(classifyPortalPayload(portal)).toBe("malformed")
        })

        it("sin progress (portal.progress.isFullyCompleted revienta el SSR)", () => {
            const portal = fullPortal()
            delete portal.progress
            expect(classifyPortalPayload(portal)).toBe("malformed")
        })

        it("registeredGuests que no es array (.some revienta isMainGuestCompleted)", () => {
            const portal = fullPortal()
            portal.registeredGuests = null
            expect(classifyPortalPayload(portal)).toBe("malformed")
        })

        it("payload que no es objeto", () => {
            expect(classifyPortalPayload(null)).toBe("malformed")
            expect(classifyPortalPayload(undefined)).toBe("malformed")
            expect(classifyPortalPayload("<html>")).toBe("malformed")
        })
    })

    it("NO exige campos cosméticos: fechas o contadores ausentes siguen siendo ready", () => {
        const portal = fullPortal()
        delete portal.reservation.arrivalDate
        delete portal.reservation.totalGuestsAllowed
        expect(classifyPortalPayload(portal)).toBe("ready")
    })
})

describe("assertRenderablePortal — malformado lanza, nunca se devuelve", () => {
    afterEach(() => vi.restoreAllMocks())

    it("devuelve intacto un payload renderizable", () => {
        const portal = asPortal(fullPortal())
        expect(assertRenderablePortal(portal)).toBe(portal)
    })

    it("deja pasar closed sin lanzar (las páginas ya manejan portalStatus)", () => {
        const closed = { portalStatus: "cancelled", message: "x" } as CheckinPortalResponse
        expect(assertRenderablePortal(closed)).toBe(closed)
    })

    it("lanza y grita por consola ante un 200 malformado", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        const portal = fullPortal()
        delete portal.progress
        expect(() => assertRenderablePortal(asPortal(portal))).toThrow(/incompleta/)
        expect(error).toHaveBeenCalled()
    })
})
