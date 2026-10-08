import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Reservation } from "@/types"

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock("../services/reservations-service", () => ({ reservationsService: { list: mocks.list } }))

import { ReservationsCalendar } from "./ReservationsCalendar"

function reservation(id: string, guestName: string): Reservation {
    const checkIn = new Date()
    const checkOut = new Date(checkIn.getTime() + 2 * 24 * 60 * 60 * 1000)
    return {
        id, guestName, propertyId: "p-1", propertyName: "Pullman", unitId: "u-1", unitName: "Suite 1",
        checkIn, checkOut, nights: 2, status: "CONFIRMED", source: "Direct", totalPrice: 0, totalGuests: 1,
    } as unknown as Reservation
}

describe("ReservationsCalendar — se entera de una reserva nueva", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.list.mockResolvedValueOnce([reservation("r-1", "Ana Gómez")])
    })

    it("vuelve a pedir la lista al crearse una reserva, sin recargar la página", async () => {
        render(<ReservationsCalendar />)
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1))
        // Entrada y salida caen en el mismo mes: el nombre sale en los dos días.
        expect((await screen.findAllByText(/Ana Gómez/)).length).toBeGreaterThan(0)

        mocks.list.mockResolvedValueOnce([reservation("r-1", "Ana Gómez"), reservation("r-2", "Luis Pérez")])
        act(() => { window.dispatchEvent(new Event("reservationCreated")) })

        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
        expect((await screen.findAllByText(/Luis Pérez/)).length).toBeGreaterThan(0)
    })
})
