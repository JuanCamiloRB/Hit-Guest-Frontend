import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { Reservation } from "@/types"
import { DataTable } from "@/components/shared/data-table"
import { getColumns } from "./columns"
import { DEFAULT_SORTING } from "./reservation-sorting"

/**
 * La tabla de Operaciones no ordenaba nada: `DataTable` ya montaba
 * `getSortedRowModel()`, pero los encabezados eran texto plano sin control que
 * lo disparara, así que las filas salían en el orden de `GET /reservations`
 * (inserción / created_at) — un criterio que la tabla ni siquiera muestra.
 */
const makeReservation = (
    id: string,
    guestName: string,
    checkIn: string,
    overrides: Partial<Reservation> = {},
): Reservation => ({
    id,
    guestName,
    email: `${id}@example.com`,
    propertyName: "Habitare Cristales",
    unitName: "H402",
    checkIn: new Date(checkIn),
    checkOut: new Date(checkIn),
    nights: 3,
    status: "CONFIRMED",
    source: "Direct",
    totalPrice: 180,
    ...overrides,
}) as Reservation

const ROWS: Reservation[] = [
    makeReservation("r1", "Bruno Perez", "2026-07-23"),
    makeReservation("r2", "ana torres", "2026-08-05"),
    makeReservation("r3", "Álvarez Diaz", "2026-07-30"),
]

/** Nombres de huésped en el orden en que la tabla los está pintando. */
function renderedGuests(): string[] {
    const rows = screen.getAllByRole("row").slice(1) // fuera el encabezado
    return rows.map((r) => within(r).getAllByRole("cell")[0].textContent ?? "")
}

function renderTable() {
    return render(
        <DataTable
            columns={getColumns()}
            data={ROWS}
            defaultSorting={[...DEFAULT_SORTING]}
        />,
    )
}

describe("ordenamiento de la tabla de reservas", () => {
    it("arranca ordenada por check-in y no por el orden del backend", () => {
        renderTable()
        // DEFAULT_SORTING es checkIn descendente: 5 ago, 30 jul, 23 jul.
        const guests = renderedGuests()
        expect(guests[0]).toContain("ana torres")
        expect(guests[1]).toContain("Álvarez Diaz")
        expect(guests[2]).toContain("Bruno Perez")
    })

    it("anuncia la columna ordenada a un lector de pantalla", () => {
        renderTable()
        const fechas = screen.getByRole("columnheader", { name: /FECHAS/i })
        expect(fechas).toHaveAttribute("aria-sort", "descending")

        const huesped = screen.getByRole("columnheader", { name: /HUÉSPED/i })
        expect(huesped).toHaveAttribute("aria-sort", "none")
    })

    it("reordena al hacer clic en el título de la columna", () => {
        renderTable()
        fireEvent.click(screen.getByRole("button", { name: /HUÉSPED/i }))

        // Ascendente, con acentos y minúsculas tratados como los lee una persona.
        const guests = renderedGuests()
        expect(guests[0]).toContain("Álvarez Diaz")
        expect(guests[1]).toContain("ana torres")
        expect(guests[2]).toContain("Bruno Perez")
    })

    it("invierte el sentido en el segundo clic", () => {
        renderTable()
        const header = screen.getByRole("button", { name: /HUÉSPED/i })
        fireEvent.click(header)
        fireEvent.click(header)

        expect(
            screen.getByRole("columnheader", { name: /HUÉSPED/i }),
        ).toHaveAttribute("aria-sort", "descending")
        expect(renderedGuests()[0]).toContain("Bruno Perez")
    })

    it("ordena por fecha de check-in de más antigua a más reciente al invertir", () => {
        renderTable()
        // Ya está en desc por defecto; un clic la pasa a asc.
        fireEvent.click(screen.getByRole("button", { name: /FECHAS/i }))

        const guests = renderedGuests()
        expect(guests[0]).toContain("Bruno Perez")   // 23 jul
        expect(guests[2]).toContain("ana torres")    // 5 ago
    })

    // El ordenamiento NO es un filtro: no puede quitar filas.
    it("conserva todas las filas al reordenar", () => {
        renderTable()
        fireEvent.click(screen.getByRole("button", { name: /HUÉSPED/i }))
        expect(renderedGuests()).toHaveLength(ROWS.length)
    })

    it("no ofrece ordenar columnas sin un criterio único", () => {
        renderTable()
        expect(
            within(screen.getByRole("columnheader", { name: /REPORTES/i })).queryByRole("button"),
        ).toBeNull()
        expect(
            within(screen.getByRole("columnheader", { name: /ACCIONES/i })).queryByRole("button"),
        ).toBeNull()
    })

    it("ordena la columna CONTRATO poniendo lo pendiente primero", () => {
        const withContracts: Reservation[] = [
            makeReservation("c1", "Firmado Uno", "2026-08-01", {
                automationStatus: { link: "success", checkin: "success", contract: "success", code: "none", tra: "none", sireIn: "none", sireOut: "none" },
            }),
            makeReservation("c2", "Pendiente Dos", "2026-08-02", {
                automationStatus: { link: "success", checkin: "success", contract: "pending", code: "none", tra: "none", sireIn: "none", sireOut: "none" },
            }),
        ]
        render(<DataTable columns={getColumns()} data={withContracts} />)
        fireEvent.click(screen.getByRole("button", { name: /CONTRATO/i }))

        expect(renderedGuests()[0]).toContain("Pendiente Dos")
    })
})
