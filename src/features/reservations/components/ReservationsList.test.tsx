import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetReservationsCache } from "../hooks/useReservations"
import type { Reservation } from "@/types"
import ReservationsList from "./ReservationsList"
import { ReservationsNotReadyError } from "../services/reservations-service"

const mocks = vi.hoisted(() => ({
    deleteHandler: null as null | ((reservation: Reservation) => void),
    list: vi.fn(),
    remove: vi.fn(),
    getReservationCost: vi.fn(),
    loadAutomationStatus: vi.fn(),
}))

vi.mock("./columns", () => ({
    getColumns: ({ onDelete }: { onDelete: (reservation: Reservation) => void }) => {
        mocks.deleteHandler = onDelete
        return []
    },
}))

vi.mock("@/components/shared/data-table", () => ({
    DataTable: ({ data, sorting, onSortingChange }: {
        data: Reservation[]
        sorting?: { id: string; desc: boolean }[]
        onSortingChange?: (next: { id: string; desc: boolean }[]) => void
    }) => (
        <>
            <span data-testid="row-count">{data.length}</span>
            <span data-testid="sorting">{sorting?.map((s) => s.id).join(",")}</span>
            <button type="button" onClick={() => mocks.deleteHandler?.(data[0])}>Solicitar eliminación</button>
            <button type="button" onClick={() => onSortingChange?.([{ id: "contract", desc: false }])}>Ordenar por contrato</button>
            <button type="button" onClick={() => onSortingChange?.([{ id: "guestName", desc: false }])}>Ordenar por huésped</button>
            <button type="button" onClick={() => onSortingChange?.([{ id: "guestName", desc: false }, { id: "checkin", desc: false }])}>Ordenar múltiple</button>
        </>
    ),
}))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { list: mocks.list, delete: mocks.remove, loadAutomationStatus: mocks.loadAutomationStatus },
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
        resetReservationsCache()
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
        resetReservationsCache()
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

describe("ReservationsList — recarga al volver a la pestaña, con límite", () => {
    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
        vi.useFakeTimers()
        mocks.list.mockResolvedValue([reservation])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    function returnToTab() {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
        document.dispatchEvent(new Event("visibilitychange"))
    }

    it("no relee si la última carga fue hace menos de un minuto; sí después", async () => {
        render(<ReservationsList />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(mocks.list).toHaveBeenCalledTimes(1)

        await act(async () => { await vi.advanceTimersByTimeAsync(10_000); returnToTab() })
        expect(mocks.list).toHaveBeenCalledTimes(1)

        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); returnToTab() })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(mocks.list).toHaveBeenCalledTimes(2)
    })
})

describe("ReservationsList — la lista compartida", () => {
    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
        mocks.deleteHandler = null
        mocks.remove.mockResolvedValue(undefined)
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("sin lista y con fallo muestra el error con Reintentar, nunca «no hay reservas»", async () => {
        mocks.list.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([reservation])
        render(<ReservationsList />)

        expect(await screen.findByText("No pudimos cargar las reservas")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(await screen.findByTestId("row-count")).toHaveTextContent("1")
        expect(mocks.list).toHaveBeenCalledTimes(2)
    })

    it("una actualización fallida conserva las filas y avisa, sin esqueleto", async () => {
        mocks.list.mockResolvedValueOnce([reservation]).mockRejectedValueOnce(new Error("503"))
        render(<ReservationsList />)
        expect(await screen.findByTestId("row-count")).toHaveTextContent("1")

        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        expect(await screen.findByText(/No pudimos actualizar la lista/)).toBeInTheDocument()
        expect(screen.getByTestId("row-count")).toHaveTextContent("1")
        expect(screen.queryByText("Cargando reservaciones")).toBeNull()
    })

    it("borrar quita la fila en el acto y no vuelve a pedir la lista", async () => {
        mocks.list.mockResolvedValue([reservation])
        mocks.getReservationCost.mockResolvedValue({ total: 0 })
        render(<ReservationsList />)

        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))

        await waitFor(() => expect(screen.getByTestId("row-count")).toHaveTextContent("0"))
        expect(mocks.remove).toHaveBeenCalledWith(reservation.id)
        expect(mocks.list).toHaveBeenCalledTimes(1)
    })
})

describe("ReservationsList — filtro de origen con los canales reales", () => {
    beforeEach(() => {
        // El Select de Radix desplaza la opción elegida a la vista; jsdom no lo implementa.
        Element.prototype.scrollIntoView = vi.fn()
        resetReservationsCache()
        vi.clearAllMocks()
        mocks.deleteHandler = null
    })

    it("ofrece los canales de la cuenta ordenados y «Origen no informado»; elegirlo deja solo las sin canal", async () => {
        mocks.list.mockResolvedValue([
            { ...reservation, id: "a", source: "Expedia", sourceSlug: "expedia" },
            { ...reservation, id: "b", source: null, sourceSlug: null },
            { ...reservation, id: "c", source: "Airbnb", sourceSlug: "airbnb" },
        ])
        render(<ReservationsList />)
        expect(await screen.findByTestId("row-count")).toHaveTextContent("3")

        fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por origen" }), { key: "Enter" })
        const options = (await screen.findAllByRole("option")).map((o) => o.textContent)
        expect(options).toEqual(["Todos los orígenes", "Airbnb", "Expedia", "Origen no informado"])

        fireEvent.click(screen.getByRole("option", { name: "Origen no informado" }))
        await waitFor(() => expect(screen.getByTestId("row-count")).toHaveTextContent("1"))
    })
})

describe("ReservationsList — ordenar por un estado espera a tenerlos todos", () => {
    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
        mocks.deleteHandler = null
        mocks.list.mockResolvedValue([
            { ...reservation, id: "a" },
            { ...reservation, id: "b" },
            { ...reservation, id: "c" },
        ])
    })

    it("ordenar por huésped es inmediato y no pide ningún estado", async () => {
        render(<ReservationsList />)
        await screen.findByTestId("row-count")
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por huésped" }))
        expect(screen.getByTestId("sorting")).toHaveTextContent("guestName")
        expect(mocks.loadAutomationStatus).not.toHaveBeenCalled()
    })

    it("ordenar por contrato: «Preparando…», pide los que faltan y recién ahí ordena; avisa cuántos fallaron", async () => {
        const pending: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []
        mocks.loadAutomationStatus.mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })))
        render(<ReservationsList />)
        await screen.findByTestId("row-count")

        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        expect(await screen.findByText(/Preparando todos los estados para ordenar… 0 de 3/)).toBeInTheDocument()
        expect(screen.getByTestId("sorting")).toHaveTextContent("checkIn")
        await waitFor(() => expect(pending).toHaveLength(3))

        await act(async () => {
            pending[0].resolve({ contract: "success" })
            pending[1].resolve({ contract: "pending" })
            pending[2].reject(new Error("503"))
        })
        await waitFor(() => expect(screen.getByTestId("sorting")).toHaveTextContent("contract"))
        expect(screen.getByText(/No se pudo cargar el estado de 1 reserva: queda al final del orden/)).toBeInTheDocument()
        expect(screen.queryByText(/Preparando/)).toBeNull()
    })

    it("Cancelar deja el orden como estaba; y si se pide otro orden mientras tanto, gana el último", async () => {
        const pending: Array<(v: unknown) => void> = []
        mocks.loadAutomationStatus.mockImplementation(() => new Promise((resolve) => pending.push(resolve)))
        render(<ReservationsList />)
        await screen.findByTestId("row-count")

        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }))
        expect(screen.queryByText(/Preparando/)).toBeNull()
        await waitFor(() => expect(pending).toHaveLength(3))
        await act(async () => pending.forEach((resolve) => resolve({ contract: "success" })))
        expect(screen.getByTestId("sorting")).toHaveTextContent("checkIn")
    })

    it("pedir otro orden mientras se prepara: gana el último", async () => {
        const pending: Array<(v: unknown) => void> = []
        mocks.loadAutomationStatus.mockImplementation(() => new Promise((resolve) => pending.push(resolve)))
        render(<ReservationsList />)
        await screen.findByTestId("row-count")

        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por huésped" }))
        expect(screen.getByTestId("sorting")).toHaveTextContent("guestName")
        await waitFor(() => expect(pending).toHaveLength(3))
        await act(async () => pending.forEach((resolve) => resolve({ contract: "success" })))
        expect(screen.getByTestId("sorting")).toHaveTextContent("guestName")
    })

    it("el orden múltiple con un estado también espera a tenerlos todos", async () => {
        mocks.loadAutomationStatus.mockImplementation(() => new Promise(() => {}))
        render(<ReservationsList />)
        await screen.findByTestId("row-count")

        fireEvent.click(screen.getByRole("button", { name: "Ordenar múltiple" }))
        expect(await screen.findByText(/Preparando todos los estados/)).toBeInTheDocument()
        expect(screen.getByTestId("sorting")).toHaveTextContent("checkIn")
    })

    it("con el orden por estado activo, una reserva nueva también recibe su estado (el orden no queda a medias)", async () => {
        mocks.loadAutomationStatus.mockResolvedValue({ contract: "success" })
        render(<ReservationsList />)
        await screen.findByTestId("row-count")
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        await waitFor(() => expect(screen.getByTestId("sorting")).toHaveTextContent("contract"))
        const before = mocks.loadAutomationStatus.mock.calls.length

        mocks.list.mockResolvedValue([
            { ...reservation, id: "a" }, { ...reservation, id: "b" }, { ...reservation, id: "c" }, { ...reservation, id: "d" },
        ])
        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        await waitFor(() => expect(mocks.loadAutomationStatus.mock.calls.slice(before).map(([r]) => r.id)).toContain("d"))
    })
})
