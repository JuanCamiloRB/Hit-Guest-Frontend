import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Reservation } from "@/types"
import type { AutomationStatusItem } from "@/features/properties/types/automation"
import { resetReservationsCache } from "../hooks/useReservations"
import { resetAutomationStatusMemory } from "../hooks/useAutomationStatusLoader"
import type { Portfolio } from "@/features/properties/lib/properties-cache"

/**
 * Qué columnas de automatización recibe la tabla según lo que la cuenta usa
 * (`visibleCellKeys` conectado en ReservationsList). La tabla y las columnas
 * son dobles: aquí solo importa QUÉ claves llegan y cuándo cambian.
 */
const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    loadAutomationStatus: vi.fn(),
    portfolio: null as Portfolio | null,
    columnsKeys: [] as string[][],
    mobileKeys: [] as string[][],
}))

vi.mock("./columns", () => ({
    getColumns: ({ cellKeys }: { cellKeys?: string[] }) => { mocks.columnsKeys.push(cellKeys ?? ["(todas)"]); return [] },
    ReservationMobileRow: ({ cellKeys }: { cellKeys?: string[] }) => { mocks.mobileKeys.push(cellKeys ?? ["(todas)"]); return null },
}))
vi.mock("../hooks/useListingPortfolio", () => ({ useListingPortfolio: () => mocks.portfolio }))
vi.mock("@/components/shared/data-table", async () => {
    const React = await import("react")
    return {
        DataTable: ({ data, onVisibleRowsChange, renderMobileRow }: {
            data: Reservation[]
            onVisibleRowsChange?: (visible: Reservation[], next: Reservation[]) => void
            renderMobileRow?: (row: Reservation) => React.ReactNode
        }) => {
            // Como la tabla real: avisa qué filas se ven para que se pida su estado.
            React.useEffect(() => { onVisibleRowsChange?.(data, []) }, [data, onVisibleRowsChange])
            return <>{data.map((row) => <div key={row.id}>{row.guestName}{renderMobileRow?.(row)}</div>)}</>
        },
    }
})
vi.mock("../services/reservations-service", () => ({
    reservationsService: { list: mocks.list, delete: vi.fn(), loadAutomationStatus: mocks.loadAutomationStatus },
    ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
}))
vi.mock("@/features/billing/services/consumption-service", () => ({ consumptionService: { getReservationCost: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import ReservationsList from "./ReservationsList"

const item = (providerSlug: string, automationName: string, status: AutomationStatusItem["status"]) =>
    ({ providerSlug, automationName, status, isPerGuest: false, guests: [] }) as unknown as AutomationStatusItem
const reservation = (id: string, guestName: string): Reservation => ({
    id, guestName, propertyName: "Pullman", unitName: "101", checkIn: new Date("2026-09-01"), checkOut: new Date("2026-09-02"), status: "CONFIRMED", source: "Direct",
}) as Reservation
const portfolio = (slugs: ReadonlySet<string> | null | undefined): Portfolio => ({ properties: [], listings: [], overview: {}, automationSlugs: slugs })
const lastKeys = () => mocks.columnsKeys[mocks.columnsKeys.length - 1]

describe("ReservationsList — columnas de automatización que la cuenta usa", () => {
    beforeEach(() => {
        resetReservationsCache()
        resetAutomationStatusMemory()
        vi.clearAllMocks()
        mocks.columnsKeys = []
        mocks.mobileKeys = []
        mocks.list.mockResolvedValue([reservation("a", "Ana Torres"), reservation("b", "Bruno Pérez")])
        mocks.loadAutomationStatus.mockImplementation(async (r: Reservation) => ({
            status: {},
            items: r.id === "a" ? [item("tra_colombia", "TRA Colombia", "completed")] : [item("sire_colombia", "SIRE Colombia — Check-in", "not_started")],
        }))
    })

    it("mientras el portafolio carga (null): las mínimas más lo que ya corrió; la tabla crece al llegar, no se contrae", async () => {
        mocks.portfolio = null
        const { rerender } = render(<ReservationsList />)
        await screen.findByText("Ana Torres")
        await waitFor(() => expect(lastKeys()).toEqual(["link", "checkin", "tra"]))
        mocks.portfolio = portfolio(new Set(["hitguest_signature"]))
        rerender(<ReservationsList />)
        await waitFor(() => expect(lastKeys()).toEqual(["link", "checkin", "contract", "tra"]))
    })

    it("si el portafolio falló (sin datos de automatizaciones): todas; nunca se oculta por no saber", async () => {
        mocks.portfolio = portfolio(undefined)
        render(<ReservationsList />)
        await screen.findByText("Ana Torres")
        expect(lastKeys()).toEqual(["link", "checkin", "contract", "code", "tra", "sireIn", "sireOut", "pdf"])
    })

    it("portafolio sin automatizaciones activas: Link y Check-in, más las que ya corrieron en alguna fila (TRA); un not_started no cuenta", async () => {
        mocks.portfolio = portfolio(new Set())
        render(<ReservationsList />)
        await screen.findByText("Ana Torres")
        await waitFor(() => expect(lastKeys()).toEqual(["link", "checkin", "tra"]))
        // La fila apilada recibe las mismas claves.
        expect(mocks.mobileKeys[mocks.mobileKeys.length - 1]).toEqual(["link", "checkin", "tra"])
    })

    it("portafolio con contrato y SIRE activos: sus columnas aunque ninguna fila los traiga; SIRE cuenta para entrada y salida", async () => {
        mocks.portfolio = portfolio(new Set(["hitguest_signature", "sire_colombia"]))
        mocks.loadAutomationStatus.mockResolvedValue({ status: {}, items: [] })
        render(<ReservationsList />)
        await screen.findByText("Ana Torres")
        await waitFor(() => expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(2))
        expect(lastKeys()).toEqual(["link", "checkin", "contract", "sireIn", "sireOut"])
    })

    it("filtrar la lista NO cambia las columnas: salen de TODAS las reservas, no de las que se ven", async () => {
        mocks.portfolio = portfolio(new Set())
        render(<ReservationsList />)
        await screen.findByText("Ana Torres")
        await waitFor(() => expect(lastKeys()).toEqual(["link", "checkin", "tra"]))
        // Buscar «Bruno» deja fuera a Ana, la única con TRA: la columna se queda.
        await act(async () => { fireEvent.change(screen.getByRole("textbox", { name: "Buscar reservas" }), { target: { value: "Bruno" } }) })
        await waitFor(() => expect(screen.queryByText("Ana Torres")).toBeNull())
        expect(lastKeys()).toEqual(["link", "checkin", "tra"])
    })
})
