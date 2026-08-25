import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CheckinPortalResponse } from "../types/checkin"
import { SuccessScreen } from "./SuccessScreen"

/** Parametrizable por test: cada caso fija la query con la que llega el huésped. */
const search = vi.hoisted(() => ({ value: "" }))

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(search.value),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        getReservationDocuments: vi.fn().mockResolvedValue([]),
        getPortal: vi.fn(),
        openDocumentPdf: vi.fn(),
        openSignedContract: vi.fn(),
    },
}))

function makePortal(overrides: Partial<CheckinPortalResponse> = {}): CheckinPortalResponse {
    return {
        reservation: {
            uuid: "reservation",
            arrivalDate: "2026-08-14",
            departureDate: "2026-08-16",
            totalGuestsAllowed: 2,
        },
        progress: { registered: 1, completed: 1, isFullyCompleted: false },
        registeredGuests: [{
            uuid: "guest-1",
            name: "Ada",
            lastname: "Lovelace",
            isMain: true,
            isCompleted: true,
        }],
        documents: [],
        ...overrides,
    } as CheckinPortalResponse
}

beforeEach(() => {
    search.value = "guest_uuid=guest-1"
})

describe("SuccessScreen — reingreso completado", () => {
    it("prioriza el estado previo sobre el copy genérico de éxito", () => {
        search.value = "guest_uuid=guest-1&entry=identity_already_completed"
        render(<SuccessScreen portal={makePortal()} reservationUuid="reservation" />)

        expect(screen.getByRole("heading", { name: "Este check-in ya estaba completado" })).toBeInTheDocument()
        expect(screen.getByText(/tipo y número de documento.*ya están registrados/i)).toBeInTheDocument()
        expect(screen.queryByText("¡Check-in Completado!")).not.toBeInTheDocument()
        expect(screen.queryByText("¡Tu Registro Está Listo!")).not.toBeInTheDocument()
    })
})

/**
 * Reporte 2026-08-21: con TuFirma, `/main/complete` responde `pending_signature`
 * y el titular queda INCOMPLETO hasta el webhook (§3 del contrato) — pero esta
 * pantalla titulaba "¡Check-in Completado!" con el check verde, así que el
 * huésped (y el PM) leían el flujo como terminado sin haber firmado nada.
 */
describe("SuccessScreen — TuFirma pendiente NO es un check-in completado", () => {
    it("recién enviado (contract_pending=1, portal aún sin reflejarlo): registro guardado, no completado", () => {
        search.value = "guest_uuid=guest-1&contract_pending=1"
        render(<SuccessScreen
            portal={makePortal({
                contract: { signingProvider: "tufirma", status: "not_started" } as CheckinPortalResponse["contract"],
            })}
            reservationUuid="reservation"
        />)

        expect(screen.getByRole("heading", { name: "Tu registro quedó guardado" })).toBeInTheDocument()
        expect(screen.getByText(/se completará cuando firmes el contrato/i)).toBeInTheDocument()
        expect(screen.queryByText("¡Check-in Completado!")).not.toBeInTheDocument()
    })

    it("reapertura del titular con la firma externa pendiente: el portal manda, sin flag", () => {
        render(<SuccessScreen
            portal={makePortal({
                contract: { signingProvider: "tufirma", status: "pending" } as CheckinPortalResponse["contract"],
            })}
            reservationUuid="reservation"
        />)

        expect(screen.getByRole("heading", { name: "Tu registro quedó guardado" })).toBeInTheDocument()
        // La tarjeta accionable de "firma en TuFirma" sigue presente con el detalle.
        expect(screen.getByText("Falta tu firma en TuFirma")).toBeInTheDocument()
        expect(screen.queryByText("¡Check-in Completado!")).not.toBeInTheDocument()
    })

    it("un acompañante completo no lee 'falta tu firma': la firma pendiente es del titular", () => {
        search.value = "guest_uuid=guest-2"
        render(<SuccessScreen
            portal={makePortal({
                registeredGuests: [
                    { uuid: "guest-1", name: "Ada", lastname: "Lovelace", isMain: true, isCompleted: false },
                    { uuid: "guest-2", name: "Grace", lastname: "Hopper", isMain: false, isCompleted: true },
                ] as CheckinPortalResponse["registeredGuests"],
                contract: { signingProvider: "tufirma", status: "pending" } as CheckinPortalResponse["contract"],
            })}
            reservationUuid="reservation"
        />)

        expect(screen.getByRole("heading", { name: "¡Check-in Completado!" })).toBeInTheDocument()
        expect(screen.queryByText("Tu registro quedó guardado")).not.toBeInTheDocument()
    })
})
