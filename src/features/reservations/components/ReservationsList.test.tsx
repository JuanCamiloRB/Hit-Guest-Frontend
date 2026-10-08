import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Reservation } from "@/types"
import ReservationsList from "./ReservationsList"
import { ReservationsNotReadyError } from "../services/reservations-service"

const mocks = vi.hoisted(() => ({
    deleteHandler: null as null | ((reservation: Reservation) => void),
    list: vi.fn(),
    remove: vi.fn(),
    getReservationCost: vi.fn(),
}))

vi.mock("./columns", () => ({
    getColumns: ({ onDelete }: { onDelete: (reservation: Reservation) => void }) => {
        mocks.deleteHandler = onDelete
        return []
    },
}))

vi.mock("@/components/shared/data-table", () => ({
    DataTable: ({ data }: { data: Reservation[] }) => (
        <>
            <span data-testid="row-count">{data.length}</span>
            <button type="button" onClick={() => mocks.deleteHandler?.(data[0])}>Solicitar eliminación</button>
        </>
    ),
}))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { list: mocks.list, delete: mocks.remove },
    ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
}))

vi.mock("@/features/billing/services/consumption-service", () => ({
    consumptionService: { getReservationCost: mocks.getReservationCost },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@/lib/notify-error", () => ({ notifyError: vi.fn() }))

const reservation = {
    id: "reservation-1",
    guestName: "Ada Lovelace",
    propertyName: "Pullman",
    unitName: "101",
    checkIn: new Date("2026-09-01"),
    checkOut: new Date("2026-09-02"),
    status: "CONFIRMED",
    source: "Direct",
} as Reservation

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

describe("ReservationsList — verificación de consumo antes de eliminar", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.deleteHandler = null
        mocks.list.mockResolvedValue([reservation])
        mocks.remove.mockResolvedValue(undefined)
    })

    it("bloquea eliminar mientras consulta y luego muestra el monto facturado", async () => {
        const pending = deferred<{ total: number }>()
        mocks.getReservationCost.mockReturnValue(pending.promise)
        render(<ReservationsList />)

        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        expect(screen.getByRole("status")).toHaveTextContent(/Verificando el consumo/)
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled()

        pending.resolve({ total: 0.75 })
        expect(await screen.findByText(/0,75/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled()
    })

    it("un fallo no se convierte en cero y exige reintentar la consulta", async () => {
        mocks.getReservationCost.mockRejectedValueOnce(new Error("network down"))
        render(<ReservationsList />)

        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos verificar el consumo/)
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled()

        mocks.getReservationCost.mockResolvedValueOnce({ total: 0 })
        fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())
    })

    it("ignora una respuesta vieja si se reabre la misma reserva", async () => {
        const first = deferred<{ total: number }>()
        const second = deferred<{ total: number }>()
        mocks.getReservationCost
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise)
        render(<ReservationsList />)

        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
        fireEvent.click(screen.getByRole("button", { name: "Solicitar eliminación" }))

        first.resolve({ total: 99 })
        await Promise.resolve()
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled()
        expect(screen.queryByText(/99,00/)).not.toBeInTheDocument()

        second.resolve({ total: 0 })
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())
    })
})

describe("ReservationsList — un «todavía no» del backend no deja la tabla en blanco", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        mocks.deleteHandler = null
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("conserva las filas cargadas y reintenta hasta que la lista vuelve", async () => {
        const second = { ...reservation, id: "reservation-2", guestName: "Grace Hopper" } as Reservation
        mocks.list
            .mockResolvedValueOnce([reservation])
            .mockRejectedValueOnce(new ReservationsNotReadyError("202"))
            .mockResolvedValueOnce([reservation, second])

        render(<ReservationsList />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByTestId("row-count")).toHaveTextContent("1")

        // Se crea una reserva: la primera relectura responde 202 (sincronizando).
        act(() => { window.dispatchEvent(new Event("reservationCreated")) })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(screen.getByTestId("row-count")).toHaveTextContent("1")

        // Reintento automático: llega la lista completa.
        await act(async () => { await vi.advanceTimersByTimeAsync(2_600) })
        expect(mocks.list).toHaveBeenCalledTimes(3)
        expect(screen.getByTestId("row-count")).toHaveTextContent("2")
    })
})
