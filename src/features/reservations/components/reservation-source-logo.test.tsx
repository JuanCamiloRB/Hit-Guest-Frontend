import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { siAirbnb, siBookingdotcom } from "simple-icons"
import type { Reservation } from "@/types"
import { getColumns } from "./columns"

/**
 * La columna ORIGEN y el filtro de origen pintan el logo de marca a partir de
 * `Reservation.source` (que el servicio ya resolvió por `slug`; ver
 * reservation-status-mapping.test.ts). Con la tabla real de columnas, no un mock.
 */

const mocks = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { list: mocks.list, delete: vi.fn() },
    ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
}))
vi.mock("@/features/billing/services/consumption-service", () => ({
    consumptionService: { getReservationCost: vi.fn() },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@/lib/notify-error", () => ({ notifyError: vi.fn() }))

function reservation(id: string, source: Reservation["source"]): Reservation {
    return {
        id,
        guestName: "Ada Lovelace",
        propertyName: "Pullman",
        unitName: "101",
        checkIn: new Date("2026-09-01"),
        checkOut: new Date("2026-09-02"),
        status: "CONFIRMED",
        source,
    } as Reservation
}

function SourceCell({ data }: { data: Reservation[] }) {
    const table = useReactTable({
        data,
        columns: getColumns().filter((c) => "accessorKey" in c && c.accessorKey === "source"),
        getCoreRowModel: getCoreRowModel(),
    })
    return (
        <table><tbody>
            {table.getRowModel().rows.map((row) => (
                <tr key={row.id} data-testid={`row-${row.original.id}`}>
                    {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                </tr>
            ))}
        </tbody></table>
    )
}

const paths = (el: HTMLElement) => Array.from(el.querySelectorAll("path")).map((p) => p.getAttribute("d"))

describe("columna ORIGEN — logo de marca por `source`", () => {
    it("Airbnb y Booking llevan su path de Simple Icons; Directo, el ícono genérico", () => {
        render(<SourceCell data={[reservation("a", "Airbnb"), reservation("b", "Booking"), reservation("d", "Direct")]} />)
        expect(paths(screen.getByTestId("row-a"))).toEqual([siAirbnb.path])
        expect(within(screen.getByTestId("row-a")).getByText("Airbnb")).toBeInTheDocument()
        expect(paths(screen.getByTestId("row-b"))).toEqual([siBookingdotcom.path])
        expect(paths(screen.getByTestId("row-d"))).not.toContain(siAirbnb.path)
        expect(paths(screen.getByTestId("row-d"))).not.toContain(siBookingdotcom.path)
    })
})

describe("filtro de origen — cada opción lleva el logo de su marca", () => {
    beforeAll(() => {
        Element.prototype.hasPointerCapture ??= () => false
        Element.prototype.releasePointerCapture ??= () => {}
        Element.prototype.scrollIntoView ??= () => {}
    })

    it("las opciones salen de las reservas y pintan su logo", async () => {
        mocks.list.mockResolvedValue([reservation("a", "Airbnb"), reservation("b", "Booking")])
        const { default: ReservationsList } = await import("./ReservationsList")
        render(<ReservationsList />)

        await waitFor(() => expect(mocks.list).toHaveBeenCalled())
        const trigger = await screen.findByRole("combobox", { name: "Filtrar por origen" })
        fireEvent.keyDown(trigger, { key: "ArrowDown" })

        const airbnb = await screen.findByRole("option", { name: "Airbnb" })
        const booking = screen.getByRole("option", { name: "Booking" })
        expect(paths(airbnb)).toEqual([siAirbnb.path])
        expect(paths(booking)).toEqual([siBookingdotcom.path])

        // Elegido y cerrado, el filtro conserva el logo de la marca.
        fireEvent.click(airbnb)
        await waitFor(() => expect(screen.queryByRole("option")).toBeNull())
        expect(trigger).toHaveTextContent("Airbnb")
        expect(paths(trigger)).toContain(siAirbnb.path)
    })
})
