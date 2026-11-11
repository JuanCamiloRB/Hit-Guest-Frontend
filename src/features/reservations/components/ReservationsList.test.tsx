import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetReservationsCache } from "../hooks/useReservations"
import { resetAutomationStatusMemory } from "../hooks/useAutomationStatusLoader"

// El semáforo consultado se recuerda entre montajes (ventana de frescura):
// cada prueba arranca sin recuerdos de la anterior.
beforeEach(() => resetAutomationStatusMemory())
import type { Reservation } from "@/types"
import ReservationsList from "./ReservationsList"
import { ReservationsNotReadyError } from "../services/reservations-service"

const mocks = vi.hoisted(() => ({
    deleteHandler: null as null | ((reservation: Reservation) => void),
    retryHandler: null as null | ((reservation: Reservation) => void),
    list: vi.fn(),
    remove: vi.fn(),
    getReservationCost: vi.fn(),
    loadAutomationStatus: vi.fn(),
}))

vi.mock("./columns", () => ({
    getColumns: ({ onDelete, onRetryStatus }: { onDelete: (reservation: Reservation) => void; onRetryStatus: (reservation: Reservation) => void }) => {
        mocks.deleteHandler = onDelete
        mocks.retryHandler = onRetryStatus
        return []
    },
}))

vi.mock("@/components/shared/data-table", () => ({
    DataTable: ({ data, sorting, onSortingChange, onVisibleRowsChange, empty }: {
        data: Reservation[]
        empty?: React.ReactNode
        sorting?: { id: string; desc: boolean }[]
        onSortingChange?: (next: { id: string; desc: boolean }[]) => void
        onVisibleRowsChange?: (visible: Reservation[], next: Reservation[]) => void
    }) => (
        <>
            <span data-testid="row-count">{data.length}</span>
            {data.length === 0 && empty}
            <span data-testid="sorting">{sorting?.map((s) => s.id).join(",")}</span>
            <span data-testid="sort-values">{data.map((r) => `${r.id}:${r.automationStatusForSort?.contract ?? "-"}`).join(",")}</span>
            <button type="button" onClick={() => mocks.deleteHandler?.(data[0])}>Solicitar eliminación</button>
            <button type="button" onClick={() => onSortingChange?.([{ id: "contract", desc: false }])}>Ordenar por contrato</button>
            <button type="button" onClick={() => onSortingChange?.([{ id: "guestName", desc: false }])}>Ordenar por huésped</button>
            <button type="button" onClick={() => onSortingChange?.([{ id: "guestName", desc: false }, { id: "checkin", desc: false }])}>Ordenar múltiple</button>
            <button type="button" onClick={() => onVisibleRowsChange?.(data.slice(0, 10), data.slice(10, 20))}>Mostrar primera página</button>
            <button type="button" onClick={() => mocks.retryHandler?.(data.find((r) => r.automationStatusFailed)!)}>Reintentar la fallida</button>
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
vi.mock("@/lib/notify-error", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/notify-error")>()),
    notifyError: vi.fn(),
}))

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
        // Dos regiones de estado: la consulta de consumo y la de la acción (vacía hasta eliminar).
        expect(screen.getAllByRole("status").some((el) => /Verificando el consumo/.test(el.textContent ?? ""))).toBe(true)
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled()

        pending.resolve({ total: 0.75 })
        expect(await screen.findByText(/0,75/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled()
    })

    it("al eliminar se ve «Eliminando…» sin cerrarse; si falla, el diálogo sigue abierto para reintentar", async () => {
        mocks.getReservationCost.mockResolvedValue({ total: 0 })
        let fail!: (e: unknown) => void
        mocks.remove.mockReturnValueOnce(new Promise((_r, reject) => { fail = reject }))
        render(<ReservationsList />)
        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))
        expect(await screen.findByRole("button", { name: "Eliminando…" })).toHaveAttribute("aria-busy", "true")
        expect(screen.getAllByRole("status").some((el) => el.textContent === "Eliminando…")).toBe(true)
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()

        await act(async () => fail(new Error("500")))
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
        expect(mocks.remove).toHaveBeenCalledTimes(1)
    })

    it("un fallo no se convierte en cero y exige reintentar la consulta", async () => {
        mocks.getReservationCost.mockRejectedValueOnce(new Error("network down"))
        render(<ReservationsList />)

        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent(/No pudimos verificar el consumo/)
        // Error que bloquea eliminar: aviso compartido `danger` + `blocking`, dentro de
        // la descripción del diálogo (se lee al abrirlo) y sin un <div> dentro de un <p>.
        expect(alert).toHaveAttribute("data-slot", "feedback-banner")
        expect(alert).toHaveAttribute("data-tone", "danger")
        const description = alert.closest("[data-slot=alert-dialog-description]")!
        expect(description.tagName).toBe("DIV")
        expect(screen.getByRole("alertdialog", { hidden: true })).toHaveAttribute("aria-describedby", description.id)
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

        const failure = (await screen.findByText("No pudimos cargar las reservas")).closest("[data-slot=feedback-banner]")
        // Un error de carga es un aviso de error bloqueante, no un estado vacío.
        expect(failure).toHaveAttribute("data-tone", "danger")
        expect(failure).toHaveAttribute("role", "alert")
        expect(screen.queryByText(/Todavía no hay reservas/)).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(await screen.findByTestId("row-count")).toHaveTextContent("1")
        expect(mocks.list).toHaveBeenCalledTimes(2)
    })

    it("sin reservas dice «Todavía no hay reservas»; con filtros sin coincidencias, «Sin resultados» y Limpiar filtros", async () => {
        mocks.list.mockResolvedValueOnce([])
        const { unmount } = render(<ReservationsList />)
        const empty = (await screen.findByText("Todavía no hay reservas")).closest("[data-slot=empty-state]")
        expect(empty).toHaveAttribute("data-kind", "empty")
        expect(empty).not.toHaveAttribute("role")
        unmount()

        resetReservationsCache()
        mocks.list.mockResolvedValueOnce([reservation])
        render(<ReservationsList />)
        expect(await screen.findByTestId("row-count")).toHaveTextContent("1")
        fireEvent.change(screen.getByPlaceholderText(/Buscar huésped/), { target: { value: "zzz-sin-coincidencias" } })

        const status = screen.getByText("Sin resultados para «zzz-sin-coincidencias»").closest("[data-slot=empty-state]")!
        expect(status).toHaveAttribute("data-kind", "no-results")
        expect(status).toHaveAttribute("role", "status")
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }))
        expect(screen.getByTestId("row-count")).toHaveTextContent("1")
    })

    it("mientras relee, las filas siguen y se anuncia «Actualizando reservas…»", async () => {
        // Sin colas `Once`: `clearAllMocks` no las vacía y una pendiente se filtraba
        // a la prueba siguiente. La primera llamada responde; las demás esperan.
        let finish: ((value: Reservation[]) => void) | null = null
        let calls = 0
        mocks.list.mockReset()
        mocks.list.mockImplementation(() => {
            calls += 1
            return calls === 1
                ? Promise.resolve([reservation])
                : new Promise<Reservation[]>((resolve) => { finish = resolve })
        })
        render(<ReservationsList />)
        expect(await screen.findByTestId("row-count")).toHaveTextContent("1")
        const indicator = document.querySelector("[data-slot=refresh-indicator]")!
        await waitFor(() => expect(indicator).toBeEmptyDOMElement())

        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        await waitFor(() => expect(indicator).toHaveTextContent("Actualizando reservas…"))
        expect(screen.getByTestId("row-count")).toHaveTextContent("1")

        await act(async () => { finish?.([reservation]) })
        await waitFor(() => expect(indicator).toBeEmptyDOMElement())
        mocks.list.mockReset()
        mocks.list.mockResolvedValue([reservation])
    })

    it("una actualización fallida conserva las filas y avisa, sin esqueleto", async () => {
        mocks.list.mockResolvedValueOnce([reservation]).mockRejectedValueOnce(new Error("503"))
        render(<ReservationsList />)
        expect(await screen.findByTestId("row-count")).toHaveTextContent("1")

        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        const notice = (await screen.findByText(/No pudimos actualizar la lista/)).closest("[data-slot=feedback-banner]")
        expect(notice).toHaveAttribute("data-tone", "warning")
        expect(notice).toHaveAttribute("role", "status")
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
        // Con éxito, el diálogo se cierra (el cierre ya no va en `finally`).
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    })

    it("un 404 al eliminar (ya no existe): cierra, avisa y relee la lista en vez de reintentar para siempre", async () => {
        const { ApiError } = await import("@/types/api")
        mocks.list.mockResolvedValue([reservation])
        mocks.getReservationCost.mockResolvedValue({ total: 0 })
        mocks.remove.mockRejectedValueOnce(new ApiError(404, { message: "No encontrada" } as never))
        render(<ReservationsList />)

        fireEvent.click(await screen.findByRole("button", { name: "Solicitar eliminación" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled())
        mocks.list.mockResolvedValue([])
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }))

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.getByTestId("row-count")).toHaveTextContent("0"))
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
        fireEvent.click(await screen.findByRole("button", { name: "Cancelar orden" }))
        expect(screen.queryByText(/Preparando/)).toBeNull()
        await waitFor(() => expect(pending).toHaveLength(3))
        await act(async () => pending.forEach((resolve) => resolve({ contract: "success" })))
        expect(screen.getByTestId("sorting")).toHaveTextContent("checkIn")
    })

    it("500 reservas, 10 visibles + 10 siguientes: «Cancelar orden» no termina consultando las otras 480", async () => {
        const many = Array.from({ length: 500 }, (_, i) => ({ ...reservation, id: `r${i}` }))
        mocks.list.mockResolvedValue(many)
        const gates: Array<() => void> = []
        mocks.loadAutomationStatus.mockImplementation(() => new Promise((resolve) => gates.push(() => resolve({ contract: "success" }))))
        render(<ReservationsList />)
        await screen.findByTestId("row-count")
        fireEvent.click(screen.getByRole("button", { name: "Mostrar primera página" }))
        // Sin respuesta todavía: lo visible ocupa los seis lugares.
        await waitFor(() => expect(gates).toHaveLength(6))

        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        fireEvent.click(await screen.findByRole("button", { name: "Cancelar orden" }))
        for (let i = 0; i < 40 && gates.length > 0; i++) {
            await act(async () => { gates.splice(0).forEach((open) => open()) })
        }

        const ids = mocks.loadAutomationStatus.mock.calls.map(([r]) => Number((r as Reservation).id.slice(1)))
        expect(ids.every((n) => n < 20)).toBe(true)
        // Lo visible y la siguiente sí llegan, aunque la preparación los había adelantado.
        expect(new Set(ids).size).toBe(20)
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

describe("ReservationsList — el conjunto cambia con un orden por estado activo", () => {
    const rowsOf = (...ids: string[]) => ids.map((id) => ({ ...reservation, id }))
    let gates: Map<string, (value: unknown) => void>
    const started = () => mocks.loadAutomationStatus.mock.calls.map(([r]) => r.id as string)

    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
        gates = new Map()
        mocks.list.mockResolvedValue(rowsOf("a", "b", "c"))
        mocks.loadAutomationStatus.mockImplementation((r: Reservation) =>
            ["a", "b", "c"].includes(r.id)
                ? Promise.resolve({ contract: "success" })
                : new Promise((resolve) => gates.set(r.id, resolve)))
    })

    async function sortedByContract() {
        render(<ReservationsList />)
        await screen.findByTestId("row-count")
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        await waitFor(() => expect(screen.getByTestId("sorting")).toHaveTextContent("contract"))
        expect(screen.queryByText(/Preparando/)).toBeNull()
    }

    async function listBecomes(...ids: string[]) {
        mocks.list.mockResolvedValue(rowsOf(...ids))
        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        await waitFor(() => expect(screen.getByTestId("row-count")).toHaveTextContent(String(ids.length)))
    }

    it("filas nuevas: vuelve «Preparando…», el orden sigue y lo que llega no mueve nada; al completar, se aplica una vez", async () => {
        await sortedByContract()
        await listBecomes("a", "b", "c", "d", "e")

        expect(await screen.findByText(/Preparando todos los estados para ordenar… 3 de 5/)).toBeInTheDocument()
        expect(screen.getByTestId("sorting")).toHaveTextContent("contract")
        await waitFor(() => expect(gates.has("e")).toBe(true))

        await act(async () => gates.get("d")!({ contract: "pending" }))
        expect(await screen.findByText(/4 de 5/)).toBeInTheDocument()
        // Se ordena con lo que se sabía al empezar: «d» sigue sin valor (al final).
        expect(screen.getByTestId("sort-values")).toHaveTextContent("d:-")

        await act(async () => gates.get("e")!({ contract: "success" }))
        await waitFor(() => expect(screen.queryByText(/Preparando/)).toBeNull())
        expect(screen.getByTestId("sort-values")).toHaveTextContent("d:pending")
        expect(screen.getByTestId("sorting")).toHaveTextContent("contract")
    })

    it("«Cancelar orden» con el conjunto a medias vuelve al último orden sin estados", async () => {
        await sortedByContract()
        await listBecomes("a", "b", "c", "d")

        fireEvent.click(await screen.findByRole("button", { name: "Cancelar orden" }))
        expect(screen.queryByText(/Preparando/)).toBeNull()
        expect(screen.getByTestId("sorting")).toHaveTextContent("checkIn")
        expect(screen.getByTestId("sorting")).not.toHaveTextContent("contract")
    })

    it("si el conjunto vuelve a cambiar durante «Preparando…», gana el último: lo que esperaba turno del anterior no sale", async () => {
        await sortedByContract()
        const first = Array.from({ length: 10 }, (_, i) => `n${i + 1}`)
        await listBecomes("a", "b", "c", ...first)
        await waitFor(() => expect(gates.size).toBe(6))

        await listBecomes("a", "b", "c", "m1", "m2")
        expect(await screen.findByText(/Preparando todos los estados para ordenar… 3 de 5/)).toBeInTheDocument()
        // Se liberan los seis en vuelo de la preparación anterior.
        await act(async () => ["n1", "n2", "n3", "n4", "n5", "n6"].forEach((id) => gates.get(id)!({ contract: "success" })))
        await waitFor(() => expect(started()).toEqual(expect.arrayContaining(["m1", "m2"])))
        expect(started()).not.toEqual(expect.arrayContaining(["n7"]))
        expect(started().filter((id) => ["n7", "n8", "n9", "n10"].includes(id))).toEqual([])

        await act(async () => { gates.get("m1")!({ contract: "success" }); gates.get("m2")!({ contract: "pending" }) })
        await waitFor(() => expect(screen.queryByText(/Preparando/)).toBeNull())
        expect(screen.getByTestId("sorting")).toHaveTextContent("contract")
    })

    it("una fila que falla mientras el conjunto crece cuenta como resultado: queda al final, con el aviso", async () => {
        await sortedByContract()
        await listBecomes("a", "b", "c", "d")
        expect(await screen.findByText(/Preparando todos los estados para ordenar… 3 de 4/)).toBeInTheDocument()
        await waitFor(() => expect(gates.has("d")).toBe(true))
        mocks.loadAutomationStatus.mockClear()

        // Un 503 se modela como rechazo: el `gate` resuelve, así que se reemplaza.
        await act(async () => { gates.get("d")!(Promise.reject(new Error("503"))) })
        await waitFor(() => expect(screen.queryByText(/Preparando/)).toBeNull())
        expect(screen.getByText(/No se pudo cargar el estado de 1 reserva: queda al final del orden/)).toBeInTheDocument()
        expect(screen.getByTestId("sort-values")).toHaveTextContent("d:-")
        expect(screen.getByTestId("sorting")).toHaveTextContent("contract")
    })

    it("reintentar la fallida con el orden ya completo no vuelve a «Preparando…» ni pone «Cancelar orden»", async () => {
        mocks.loadAutomationStatus.mockImplementation((r: Reservation) =>
            r.id === "a" ? Promise.reject(new Error("503")) : Promise.resolve({ contract: "success" }))
        await sortedByContract()
        expect(screen.getByText(/No se pudo cargar el estado de 1 reserva/)).toBeInTheDocument()

        let finish!: (value: unknown) => void
        mocks.loadAutomationStatus.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
        fireEvent.click(screen.getByRole("button", { name: "Reintentar la fallida" }))
        expect(screen.queryByText(/Preparando/)).toBeNull()
        expect(screen.queryByRole("button", { name: "Cancelar orden" })).toBeNull()
        expect(screen.getByTestId("sorting")).toHaveTextContent("contract")
        // Mientras se reintenta deja de contar como fallida.
        expect(screen.queryByText(/No se pudo cargar el estado/)).toBeNull()

        await waitFor(() => expect(finish).toBeDefined())
        await act(async () => finish({ contract: "pending" }))
        expect(screen.getByTestId("sort-values")).toHaveTextContent("a:pending")
        expect(screen.getByTestId("sorting")).toHaveTextContent("contract")
    })

    it("si el filtro cambia durante el PRIMER «Preparando…», se prepara el conjunto nuevo y el orden se aplica al completarlo", async () => {
        render(<ReservationsList />)
        await screen.findByTestId("row-count")
        await listBecomes("a", "b", "x")
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por contrato" }))
        expect(await screen.findByText(/Preparando todos los estados para ordenar… 2 de 3/)).toBeInTheDocument()

        await listBecomes("a", "y")
        expect(await screen.findByText(/Preparando todos los estados para ordenar… 1 de 2/)).toBeInTheDocument()
        expect(screen.getByTestId("sorting")).toHaveTextContent("checkIn")
        await waitFor(() => expect(gates.has("y")).toBe(true))

        await act(async () => gates.get("y")!({ contract: "pending" }))
        await waitFor(() => expect(screen.getByTestId("sorting")).toHaveTextContent("contract"))
        expect(screen.queryByText(/Preparando/)).toBeNull()
    })
})
