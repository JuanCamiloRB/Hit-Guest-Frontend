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
/** Filas del cuerpo: el encabezado tiene dos (grupos y columnas). */
const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row")

describe("tabla de Operaciones — lenguaje compartido", () => {
    it("encabezados en caso de oración, no en mayúsculas forzadas", () => {
        renderRows([reservation()])
        for (const name of ["Huésped / Alojamiento", "Fechas", "Origen", "Estado", "Automatizaciones", "Link", "Check-in", "Contrato", "Acceso", "Reportes", "TRA", "SIRE in", "SIRE out", "Acciones"]) {
            expect(screen.getByRole("columnheader", { name: new RegExp(`^${name}`) })).toBeInTheDocument()
        }
        // El reporte de huéspedes (antes «PDF»), bajo «Reportes»: exacto, para no
        // confundirlo con «Huésped / Alojamiento».
        expect(screen.getByRole("columnheader", { name: "Huésped" })).toBeInTheDocument()
    })

    it("el estado se dice con palabra (StatusPill), sin aria-label sobre un span sin rol", () => {
        renderRows([reservation(), reservation({ id: "r2", status: "CANCELLED" })])
        const [confirmed, cancelled] = bodyRows()
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
        const cell = within(bodyRows()[0]).getAllByRole("cell")[0]
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
    // Antes los tres reportes compartían una celda con sus siglas; ahora cada uno
    // tiene su columna (con la sigla en el encabezado) y su celda dice el estado.
    it("un reporte no configurado es «—» con su nombre accesible, nunca una celda vacía", () => {
        renderRows([reservation({ automationStatus: {} as Reservation["automationStatus"], automationItems: [] })])
        for (const name of ["TRA", "SIRE in", "SIRE out", "Reporte de huéspedes"]) {
            const tile = screen.getByRole("button", { name: `${name}: no configurado` })
            expect(tile).toBeDisabled()
            expect(tile).toHaveAttribute("data-tone", "none")
        }
    })
})
