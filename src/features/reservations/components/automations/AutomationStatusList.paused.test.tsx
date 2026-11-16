import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AutomationStatusList } from "./AutomationStatusList"

// El hook real: lo que se prueba es el camino lista → tarjeta con datos de la API.
const mocks = vi.hoisted(() => ({ getReservationStatus: vi.fn(), redispatch: vi.fn() }))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@/features/properties/services/automation-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/properties/services/automation-service")>()),
    automationService: {
        getReservationStatus: mocks.getReservationStatus,
        redispatch: mocks.redispatch,
        dispatch: vi.fn(),
        resendPdf: vi.fn(),
        getUsageRecords: vi.fn().mockResolvedValue([]),
    },
}))

describe("AutomationStatusList — automatización en pausa por credenciales (nota backend 2026-11-11)", () => {
    it("una fila pending con credentials_rejected llega a la tarjeta como «En pausa», con el enlace a la propiedad", async () => {
        mocks.getReservationStatus.mockResolvedValue([{
            automationUuid: "tra", automationName: "TRA", providerSlug: "tra_colombia", status: "pending",
            lastError: "credentials_rejected", lastRunAt: null, usageRecordId: 7, contractPdfPath: null, wasSuccessful: false,
            lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: true,
            reservationCheckinCompleted: true, mainGuestCheckinCompleted: true, canDispatch: true, canRedispatch: true,
            isPerGuest: false, guests: [],
        }])
        render(<AutomationStatusList reservationUuid="res-1" totalGuests={2} propertyUuid="prop-1" />)
        expect(await screen.findByText("En pausa")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Actualizar credenciales/ })).toHaveAttribute("href", "/dashboard/properties/prop-1?tab=automations")
        expect(screen.queryByRole("button", { name: /Reintentar|Disparar/ })).toBeNull()
    })

    it("tras el 422, una lectura atrasada en pending no enciende el indicador de sondeo ni devuelve el reintento", async () => {
        const row = {
            automationUuid: "tra", automationName: "TRA", providerSlug: "tra_colombia", status: "failed",
            lastError: null, lastRunAt: "2026-11-11 08:15:02", usageRecordId: 7, contractPdfPath: null, wasSuccessful: false,
            lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: true,
            reservationCheckinCompleted: true, mainGuestCheckinCompleted: true, canDispatch: false, canRedispatch: true,
            isPerGuest: false, guests: [],
        }
        mocks.getReservationStatus.mockResolvedValueOnce([row])
        render(<AutomationStatusList reservationUuid="res-1" totalGuests={2} propertyUuid="prop-1" />)
        const retry = await screen.findByRole("button", { name: /Reintentar/ })

        mocks.getReservationStatus.mockResolvedValue([{ ...row, status: "pending" }])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("En pausa"), { status: 422, code: "CREDENTIALS_REJECTED" }))
        fireEvent.click(retry)

        expect(await screen.findByText("En pausa")).toBeInTheDocument()
        // La lectura posterior al 422 (atrasada: pending) ya llegó.
        await waitFor(() => expect(mocks.getReservationStatus.mock.calls.length).toBeGreaterThanOrEqual(2))
        expect(document.querySelector('[data-slot="refresh-indicator"]')).toHaveAttribute("data-active", "false")
        expect(screen.queryByRole("button", { name: /Reintentar/ })).toBeNull()
        expect(screen.getByRole("link", { name: /Actualizar credenciales/ })).toBeInTheDocument()
    })
})
