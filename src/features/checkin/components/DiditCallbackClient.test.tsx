import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { DiditCallbackClient } from "./DiditCallbackClient"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace }),
}))

const resolveDiditSessionContext = vi.fn()
vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        resolveDiditSessionContext: (...args: unknown[]) => resolveDiditSessionContext(...args),
    },
}))

/**
 * Regression for the Didit callback (20260805).
 *
 * The backend sends the guest back to
 *   /checkin/{reservationUuid}/{guestUuid}/callback
 * putting both ids in the PATH on purpose, so the flow survives a lost or stale
 * localStorage (mobile in-app browser → Safari, private mode). resolveContext
 * used to read localStorage FIRST, which inverted that guarantee.
 */
const RESERVATION_IN_URL = "019fcf54-27e1-7339-bb03-af90dd7be9d2"
const OTHER_RESERVATION = "019fcf86-33b4-70fe-abf4-dadd2379a669"
const GUEST = "019efbeb-c1e2-72ed-a555-c9c4aba457da"

function seedPendingContext(ctx: Record<string, unknown>) {
    localStorage.setItem("checkin-pending-didit", JSON.stringify({
        step: "biometric",
        startedAt: Date.now(),
        ...ctx,
    }))
}

describe("DiditCallbackClient — context resolution", () => {
    beforeEach(() => {
        replace.mockReset()
        resolveDiditSessionContext.mockReset()
        resolveDiditSessionContext.mockResolvedValue(null)
        localStorage.clear()
    })

    it("uses the reservation from the URL even when localStorage holds a different, still-valid one", () => {
        // Same guest, earlier reservation, inside the 2h TTL — the exact shape
        // that used to send the guest back to the wrong reservation.
        seedPendingContext({
            reservationUuid: OTHER_RESERVATION,
            guestUuid: GUEST,
            basePath: `/checkin/${OTHER_RESERVATION}`,
        })

        render(
            <DiditCallbackClient
                verificationSessionId="sess-1"
                status="Approved"
                reservationUuid={RESERVATION_IN_URL}
                guestUuid={GUEST}
            />,
        )

        expect(replace).toHaveBeenCalledWith(
            `/checkin/${RESERVATION_IN_URL}/verify?guest_uuid=${GUEST}&from_didit_callback=1`,
        )
    })

    it("keeps the stored basePath when it belongs to the SAME reservation (secondary-guest link)", () => {
        const secondaryBase = `/checkin/${RESERVATION_IN_URL}/s/guest-token-abc`
        seedPendingContext({
            reservationUuid: RESERVATION_IN_URL,
            guestUuid: GUEST,
            basePath: secondaryBase,
        })

        render(
            <DiditCallbackClient
                verificationSessionId="sess-1"
                status="Approved"
                reservationUuid={RESERVATION_IN_URL}
                guestUuid={GUEST}
            />,
        )

        expect(replace).toHaveBeenCalledWith(
            `${secondaryBase}/verify?guest_uuid=${GUEST}&from_didit_callback=1`,
        )
    })

    it("falls back to localStorage when the URL carries no ids (legacy /checkin/didit/callback)", () => {
        seedPendingContext({
            reservationUuid: OTHER_RESERVATION,
            guestUuid: GUEST,
            basePath: `/checkin/${OTHER_RESERVATION}`,
        })

        render(<DiditCallbackClient verificationSessionId="" status="Approved" />)

        expect(replace).toHaveBeenCalledWith(
            `/checkin/${OTHER_RESERVATION}/verify?guest_uuid=${GUEST}&from_didit_callback=1`,
        )
    })

    it("resumes from the URL alone with no stored context at all", () => {
        render(
            <DiditCallbackClient
                verificationSessionId=""
                status="Approved"
                reservationUuid={RESERVATION_IN_URL}
                guestUuid={GUEST}
            />,
        )

        expect(replace).toHaveBeenCalledWith(
            `/checkin/${RESERVATION_IN_URL}/verify?guest_uuid=${GUEST}&from_didit_callback=1`,
        )
    })

    it("shows the expired state when neither the URL nor localStorage has a reservation", () => {
        const { getByText } = render(
            <DiditCallbackClient verificationSessionId="" status="Approved" />,
        )

        expect(getByText("Sesión expirada")).toBeInTheDocument()
        expect(replace).not.toHaveBeenCalled()
    })

    /**
     * Rescate por sessionId. Es el caso del navegador embebido (WhatsApp/Instagram
     * → Safari) y el modo privado: el localStorage no se comparte y, si el backend
     * no anexó la reserva a la URL, no queda contexto local. Antes esto moría en
     * "Sesión expirada" y el huésped tenía que rehacer la verificación entera.
     */
    describe("recuperación por verificationSessionId", () => {
        it("resuelve el contexto contra el backend cuando no hay nada local", async () => {
            resolveDiditSessionContext.mockResolvedValue({
                reservationUuid: RESERVATION_IN_URL,
                guestUuid: GUEST,
            })

            render(<DiditCallbackClient verificationSessionId="sess-abc" status="Approved" />)

            await waitFor(() => {
                expect(replace).toHaveBeenCalledWith(
                    `/checkin/${RESERVATION_IN_URL}/verify?guest_uuid=${GUEST}&from_didit_callback=1`,
                )
            })
            expect(resolveDiditSessionContext).toHaveBeenCalledWith("sess-abc")
        })

        it("NO consulta al backend cuando el contexto local alcanza", () => {
            render(
                <DiditCallbackClient
                    verificationSessionId="sess-abc"
                    status="Approved"
                    reservationUuid={RESERVATION_IN_URL}
                    guestUuid={GUEST}
                />,
            )

            // El caso feliz no paga una ida de red extra.
            expect(resolveDiditSessionContext).not.toHaveBeenCalled()
            expect(replace).toHaveBeenCalled()
        })

        it("cae en 'Sesión expirada' si el backend tampoco puede resolverlo", async () => {
            resolveDiditSessionContext.mockResolvedValue(null)

            const { findByText } = render(
                <DiditCallbackClient verificationSessionId="sess-desconocida" status="Approved" />,
            )

            expect(await findByText("Sesión expirada")).toBeInTheDocument()
            expect(replace).not.toHaveBeenCalled()
        })

        it("respeta un status de fallo también en el camino recuperado", async () => {
            resolveDiditSessionContext.mockResolvedValue({
                reservationUuid: RESERVATION_IN_URL,
                guestUuid: GUEST,
            })

            const { findByText } = render(
                <DiditCallbackClient verificationSessionId="sess-abc" status="Declined" />,
            )

            expect(await findByText("Verificación no completada")).toBeInTheDocument()
        })
    })
})
