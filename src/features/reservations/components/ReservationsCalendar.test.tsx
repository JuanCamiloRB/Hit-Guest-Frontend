import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { addDays, format, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetReservationsCache } from "../hooks/useReservations"
import type { Reservation } from "@/types"

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))
vi.mock("../services/reservations-service", () => ({ ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
    reservationsService: { list: mocks.list } }))

import { ReservationsCalendar } from "./ReservationsCalendar"
import { periodLabel, windowDays } from "../lib/occupancy"

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
        resetReservationsCache()
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

describe("ReservationsCalendar — diseño 2026-11-25: ocupación y mes", () => {
    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
        globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }
    })

    async function renderWith(list: Reservation[]) {
        mocks.list.mockResolvedValue(list)
        render(<ReservationsCalendar />)
        await waitFor(() => expect(mocks.list).toHaveBeenCalled())
        await act(async () => {})
    }

    it("abre en Ocupación: periodo de 14 días en la barra navy, la estadía como barra-enlace a la reserva y la leyenda", async () => {
        await renderWith([reservation("r-1", "Kayla")])
        const today = startOfDay(new Date())
        expect(screen.getByRole("heading", { level: 2, name: periodLabel(windowDays(today)) })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Ocupación" })).toHaveAttribute("aria-selected", "true")
        const bar = screen.getByRole("link", { name: /^Kayla, Suite 1: check-in/ })
        expect(bar).toHaveAttribute("href", "/dashboard/reservations/r-1")
        expect(bar).toHaveTextContent("Kayla · 2 noches")
        expect(screen.getByRole("region", { name: "Ocupación por alojamiento" })).toHaveTextContent("Suite 1")
        expect(screen.getByText("Mostrando 1 de 1 alojamiento con reservas")).toBeInTheDocument()
        expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("Check-inEstadíaCheckout")
        // El filtro de movimientos es de la vista Mes.
        expect(screen.queryByRole("group", { name: "Filtrar movimientos" })).toBeNull()
    })

    it("las flechas mueven 14 días y «Hoy» vuelve; fuera del periodo, el vacío lo dice", async () => {
        await renderWith([reservation("r-1", "Kayla")])
        const today = startOfDay(new Date())
        fireEvent.click(screen.getByRole("button", { name: "Periodo siguiente" }))
        expect(screen.getByRole("heading", { level: 2, name: periodLabel(windowDays(addDays(today, 14))) })).toBeInTheDocument()
        expect(screen.getByText("No hay estadías en este periodo")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }))
        expect(screen.getByRole("link", { name: /^Kayla/ })).toBeInTheDocument()
    })

    it("buscar por huésped o alojamiento deja solo esas filas", async () => {
        const other = { ...reservation("r-2", "Luis Pérez"), unitId: "u-2", unitName: "Suite 2" } as Reservation
        await renderWith([reservation("r-1", "Kayla"), other])
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar alojamiento o huésped" }), { target: { value: "suite 2" } })
        expect(screen.queryByRole("link", { name: /^Kayla/ })).toBeNull()
        expect(screen.getByRole("link", { name: /^Luis Pérez/ })).toBeInTheDocument()
    })

    it("filtros exactos de selección múltiple: propiedades y alojamientos; el de alojamientos se acota a las propiedades elegidas", async () => {
        const a = { ...reservation("r-1", "Kayla"), unitId: "u-1", unitName: "1202 Alcázar", propertyId: "p-1", propertyName: "Host Medellín" } as Reservation
        const b = { ...reservation("r-2", "Luis Pérez"), unitId: "u-2", unitName: "1205 Alcázar", propertyId: "p-1", propertyName: "Host Medellín" } as Reservation
        const c = { ...reservation("r-3", "Ana Gómez"), unitId: "u-3", unitName: "203 Distrito", propertyId: "p-2", propertyName: "Distrito Primavera" } as Reservation
        await renderWith([a, b, c])
        const user = userEvent.setup()
        // Alojamientos de nombre parecido: el filtro exacto deja solo 1205.
        await user.click(screen.getByRole("button", { name: /^Filtrar por alojamiento/ }))
        await user.click(screen.getByRole("checkbox", { name: "1205 Alcázar" }))
        expect(screen.queryByRole("link", { name: /^Kayla/ })).toBeNull()
        expect(screen.getByRole("link", { name: /^Luis Pérez/ })).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: /^Ana Gómez/ })).toBeNull()
        await user.keyboard("{Escape}")
        // Elegir otra propiedad quita el alojamiento elegido que no le pertenece.
        await user.click(screen.getByRole("button", { name: /^Filtrar por propiedad/ }))
        await user.click(screen.getByRole("checkbox", { name: "Distrito Primavera" }))
        expect(screen.getByRole("link", { name: /^Ana Gómez/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Filtrar por alojamiento: Todos los alojamientos" })).toBeInTheDocument()
        await user.keyboard("{Escape}")
        await user.click(screen.getByRole("button", { name: /^Filtrar por alojamiento/ }))
        expect(screen.queryByRole("checkbox", { name: "1205 Alcázar" })).toBeNull()
        expect(screen.getByRole("checkbox", { name: "203 Distrito" })).toBeInTheDocument()
    })

    it("vista Mes: el mes en español, entradas y salidas con la misma marca, y el filtro de movimientos", async () => {
        await renderWith([reservation("r-1", "Kayla")])
        fireEvent.mouseDown(screen.getByRole("tab", { name: "Mes" }), { button: 0 })
        await act(async () => {})
        const month = format(new Date(), "MMMM yyyy", { locale: es })
        expect(screen.getByRole("heading", { level: 2, name: month.charAt(0).toUpperCase() + month.slice(1) })).toBeInTheDocument()
        const checkin = screen.getByRole("link", { name: "Check-in · Kayla · Suite 1" })
        expect(checkin.querySelector('[data-slot="movement-mark"][data-kind="checkin"]')).not.toBeNull()
        expect(screen.getAllByRole("link", { name: /^Checkout · Kayla/ }).length).toBeGreaterThan(0)
        fireEvent.click(screen.getByRole("button", { name: "Solo check-in" }))
        expect(screen.queryByRole("link", { name: /^Checkout · Kayla/ })).toBeNull()
        expect(screen.queryByText(/Today|Sun|Mon/)).toBeNull()
        // En el mes no hay barras: la leyenda dice solo las dos marcas.
        expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("Check-inCheckout")
    })
})

describe("ReservationsCalendar — un filtro no queda activo y escondido (revisión 2, 2026-11-25)", () => {
    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
        globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }
    })

    it("elegir un alojamiento → la lista se refresca sin él → el filtro queda limpio de verdad (dice «Todos» y muestra todo)", async () => {
        const a = { ...reservation("r-1", "Kayla"), unitId: "u-1", unitName: "1202 Alcázar" } as Reservation
        const b = { ...reservation("r-2", "Luis Pérez"), unitId: "u-2", unitName: "1205 Alcázar" } as Reservation
        mocks.list.mockResolvedValueOnce([a, b])
        render(<ReservationsCalendar />)
        await screen.findByRole("link", { name: /^Kayla/ })
        const user = userEvent.setup()
        await user.click(screen.getByRole("button", { name: /^Filtrar por alojamiento/ }))
        await user.click(screen.getByRole("checkbox", { name: "1205 Alcázar" }))
        await user.keyboard("{Escape}")
        expect(screen.queryByRole("link", { name: /^Kayla/ })).toBeNull()
        // El alojamiento elegido deja de existir (se borró su reserva) y llega otra.
        const c = { ...reservation("r-3", "Ana Gómez"), unitId: "u-3", unitName: "203 Distrito" } as Reservation
        mocks.list.mockResolvedValueOnce([a, c])
        act(() => { window.dispatchEvent(new Event("reservationCreated")) })
        expect(await screen.findByRole("link", { name: /^Ana Gómez/ })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /^Kayla/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Filtrar por alojamiento: Todos los alojamientos" })).toBeInTheDocument()
        // Si el alojamiento vuelve, el filtro NO se reactiva solo.
        mocks.list.mockResolvedValueOnce([a, b, c])
        act(() => { window.dispatchEvent(new Event("reservationCreated")) })
        expect(await screen.findByRole("link", { name: /^Luis Pérez/ })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /^Kayla/ })).toBeInTheDocument()
    })

    it("el vacío nombra los tres filtros", async () => {
        mocks.list.mockResolvedValueOnce([])
        render(<ReservationsCalendar />)
        expect(await screen.findByText("Cambia de periodo con las flechas, o quita la búsqueda y los filtros de propiedad y de alojamiento.")).toBeInTheDocument()
    })
})

describe("ReservationsCalendar — escala de estados (revisión 2026-11-25)", () => {
    beforeEach(() => {
        resetReservationsCache()
        vi.clearAllMocks()
    })

    it("un error sin lista es un aviso bloqueante con «Reintentar», nunca «no hay estadías»; reintentar vuelve a pedir", async () => {
        mocks.list.mockRejectedValueOnce(new Error("500"))
        render(<ReservationsCalendar />)
        expect(await screen.findByText("No pudimos cargar las reservas")).toBeInTheDocument()
        expect(screen.queryByText("No hay estadías en este periodo")).toBeNull()
        mocks.list.mockResolvedValueOnce([reservation("r-1", "Kayla")])
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reintentar" })) })
        expect(await screen.findByRole("link", { name: /^Kayla/ })).toBeInTheDocument()
    })

    it("sincronizando (202) sin lista: aviso de sincronización, no error ni vacío", async () => {
        const { ReservationsNotReadyError } = await import("../services/reservations-service")
        mocks.list.mockRejectedValue(new ReservationsNotReadyError("202"))
        render(<ReservationsCalendar />)
        expect(await screen.findByText("Las reservas se están sincronizando")).toBeInTheDocument()
        expect(screen.queryByText("No pudimos cargar las reservas")).toBeNull()
        expect(screen.queryByText("No hay estadías en este periodo")).toBeNull()
    })

    it("con lista, una actualización fallida conserva el calendario y avisa", async () => {
        mocks.list.mockResolvedValueOnce([reservation("r-1", "Kayla")])
        render(<ReservationsCalendar />)
        expect(await screen.findByRole("link", { name: /^Kayla/ })).toBeInTheDocument()
        mocks.list.mockRejectedValueOnce(new Error("500"))
        act(() => { window.dispatchEvent(new Event("reservationCreated")) })
        expect(await screen.findByText(/No pudimos actualizar el calendario/)).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /^Kayla/ })).toBeInTheDocument()
    })

    it("el vacío solo con la lista cargada bien", async () => {
        mocks.list.mockResolvedValueOnce([])
        render(<ReservationsCalendar />)
        expect(await screen.findByText("No hay estadías en este periodo")).toBeInTheDocument()
    })
})
