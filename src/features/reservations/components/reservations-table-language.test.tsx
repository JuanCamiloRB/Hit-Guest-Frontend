import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { Reservation } from "@/types"
import { DataTable } from "@/components/shared/data-table"
import { getColumns } from "./columns"

/** Lenguaje de tabla compartido (Fase 3.1) aplicado a Operaciones. */
const reservation = (over: Partial<Reservation> = {}): Reservation => ({
    id: "r1",
    guestName: "Huésped 26 Prueba",
    email: "r1@example.com",
    propertyName: "Casa Mar",
    unitName: "Suite 101",
    checkIn: new Date("2026-11-27"),
    checkOut: new Date("2026-11-29"),
    nights: 2,
    status: "CONFIRMED",
    source: "Airbnb",
    totalPrice: 180,
    ...over,
}) as Reservation

const renderRows = (rows: Reservation[]) => render(<DataTable columns={getColumns()} data={rows} />)

describe("tabla de Operaciones — lenguaje compartido", () => {
    it("encabezados en caso de oración, no en mayúsculas forzadas", () => {
        renderRows([reservation()])
        for (const name of ["Huésped / Alojamiento", "Fechas", "Origen", "Estado", "Link", "Check-in", "Contrato", "Acceso", "Reportes", "Acciones"]) {
            expect(screen.getByRole("columnheader", { name: new RegExp(`^${name}`) })).toBeInTheDocument()
        }
    })

    it("el estado se dice con palabra (StatusPill), sin aria-label sobre un span sin rol", () => {
        renderRows([reservation(), reservation({ id: "r2", status: "CANCELLED" })])
        const [confirmed, cancelled] = screen.getAllByRole("row").slice(1)
        const pill = within(confirmed).getByText("Confirmada").closest("[data-slot=status-pill]")!
        expect(pill).toHaveAttribute("data-tone", "success")
        // Sin afirmar «automatizaciones activas»: la reserva sola no lo sabe.
        expect(pill).not.toHaveAttribute("title")
        expect(confirmed).not.toHaveTextContent(/automatizaciones activas/)
        expect(within(cancelled).getByText("Cancelada").closest("[data-slot=status-pill]")).toHaveAttribute("data-tone", "danger")
        expect(document.querySelector("span[aria-label]:not([role])")).toBeNull()
    })

    it("la fila no lleva avatar de iniciales: nombre (enlace) y debajo alojamiento · propiedad", () => {
        renderRows([reservation()])
        const cell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0]
        expect(within(cell).queryByText("HP")).toBeNull()
        expect(cell.querySelector("[data-slot=avatar]")).toBeNull()
        expect(within(cell).getByRole("link", { name: "Huésped 26 Prueba" })).toHaveAttribute("href", "/dashboard/reservations/r1")
        expect(cell).toHaveTextContent("Suite 101 · Casa Mar")
    })

    it("con una sola página no muestra «Página 1 de N» (antes decía «Página 1 de 0» sin filas)", () => {
        const { unmount } = renderRows([reservation()])
        expect(screen.queryByText(/Página/)).toBeNull()
        unmount()
        renderRows([])
        expect(screen.queryByText(/Página/)).toBeNull()
    })
})

describe("tabla de Operaciones — Reportes", () => {
    it("un reporte que no aplica dice su sigla en ink-3 (texto real, AA), no en ink-4", () => {
        renderRows([reservation({ automationStatus: {} as Reservation["automationStatus"] })])
        const cell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[8]
        const pills = cell.querySelectorAll("[data-slot=status-pill][data-tone=none]")
        expect(pills.length).toBeGreaterThan(0)
        pills.forEach((pill) => expect(pill).toHaveClass("text-ink-3"))
    })
})
