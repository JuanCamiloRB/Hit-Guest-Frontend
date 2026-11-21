import { configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

// La tabla + el panel lateral (Radix) tardan más de 1 s en montar cuando corre
// la suite completa en paralelo: con el límite por defecto, una prueba fallaba
// por tiempo y pasaba sola (auditoría 2026-10-20). No es lógica: es margen.
configure({ asyncUtilTimeout: 4000 })
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    listClients: vi.fn(),
    listClientUsers: vi.fn(),
    params: new URLSearchParams(),
    toastInfo: vi.fn(),
    small: false,
}))
vi.mock("@/hooks/useMediaQuery", () => ({ SMALL_SCREEN_QUERY: "(max-width: 767px)", useMediaQuery: () => mocks.small }))
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))
vi.mock("sonner", () => ({ toast: { info: mocks.toastInfo, success: vi.fn(), error: vi.fn() } }))
vi.mock("../services/support-service", () => ({
    supportService: { listClients: mocks.listClients, listClientUsers: mocks.listClientUsers },
}))
vi.mock("../lib/support-session", () => ({ enterSupportSession: vi.fn() }))

import { SupportConsole } from "./SupportConsole"

const CLIENT = { uuid: "c-1", name: "Casa Rentals252a2", email: "contacto@casa.test", identificationNumber: "900123456", usersCount: 3 }
const INTERNAL = { uuid: "c-hit", name: "HiTGuest -", email: "it@hitguest.com", identificationNumber: "100200300-4", usersCount: 0 }
const ANA = { uuid: "u-1", name: "Ana Pérez", email: "ana@casa.test", role: "property_manager", isAccountOwner: true, verified: true, canOpenSession: true }

/** La tabla compartida pinta la tabla (md+) o las filas apiladas (móvil), según el ancho. */
const table = () => screen.getByRole("table")

describe("SupportConsole — tabla a todo el ancho + panel lateral (auditorías 2026-10-16)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.small = false
        mocks.params = new URLSearchParams()
        mocks.listClients.mockResolvedValue({ items: [CLIENT, INTERNAL], meta: { currentPage: 1, lastPage: 1, total: 2 } })
        mocks.listClientUsers.mockResolvedValue([ANA])
    })

    it("busca con el texto escrito y dice cuántos clientes hay", async () => {
        render(<SupportConsole />)
        fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "Rentals" } })
        fireEvent.submit(screen.getByRole("search"))
        await waitFor(() => expect(mocks.listClients).toHaveBeenLastCalledWith({ search: "Rentals", page: 1 }))
        expect(await screen.findByText(/2 clientes/)).toBeInTheDocument()
    })

    it("la tabla muestra cliente, correo, identificación y usuarios en columnas", async () => {
        render(<SupportConsole />)
        const row = (await within(await screen.findByRole("table")).findByText("Casa Rentals252a2")).closest("tr")!
        expect(within(row).getByText("contacto@casa.test")).toBeInTheDocument()
        expect(within(row).getByText("900123456")).toBeInTheDocument()
        expect(within(row).getByText("3 usuarios")).toBeInTheDocument()
    })

    it("en móvil la misma información va en filas apiladas, con su botón", async () => {
        mocks.small = true
        render(<SupportConsole />)
        const card = (await screen.findByText("Casa Rentals252a2")).closest("li")!
        expect(screen.queryByRole("table")).toBeNull()
        expect(card).toHaveTextContent("contacto@casa.test")
        expect(card).toHaveTextContent("ID 900123456")
        expect(within(card).getByRole("button", { name: "Ver usuarios de Casa Rentals252a2" })).toBeInTheDocument()
    })

    it("un cliente sin usuarios sigue legible pero no ofrece «Ver usuarios»", async () => {
        render(<SupportConsole />)
        const row = (await within(await screen.findByRole("table")).findByText("HiTGuest -")).closest("tr")!
        expect(within(row).getByText("Sin usuarios")).toBeInTheDocument()
        expect(within(row).queryByRole("button")).toBeNull()
    })

    it("la fila no abre nada: la única acción es «Ver usuarios»", async () => {
        render(<SupportConsole />)
        fireEvent.click((await within(await screen.findByRole("table")).findByText("Casa Rentals252a2")).closest("tr")!)
        expect(screen.queryByRole("dialog")).toBeNull()
    })

    it("«Ver usuarios» abre el panel con los usuarios de ese cliente", async () => {
        render(<SupportConsole />)
        await screen.findByRole("table")
        fireEvent.click(within(table()).getByRole("button", { name: "Ver usuarios de Casa Rentals252a2" }))
        const dialog = await screen.findByRole("dialog")
        expect(dialog).toHaveTextContent("Casa Rentals252a2")
        await waitFor(() => expect(mocks.listClientUsers).toHaveBeenCalledWith("c-1"))
        expect(await within(dialog).findByRole("radio", { name: /Ana Pérez/ })).toBeInTheDocument()
    })

    it("al cerrar el panel, el foco vuelve al botón que lo abrió", async () => {
        render(<SupportConsole />)
        await screen.findByRole("table")
        const trigger = within(table()).getByRole("button", { name: "Ver usuarios de Casa Rentals252a2" })
        trigger.focus()
        fireEvent.click(trigger)
        fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        await waitFor(() => expect(trigger).toHaveFocus())
    })

    it("al volver por una sesión cerrada, avisa", () => {
        mocks.params = new URLSearchParams("session=ended")
        render(<SupportConsole />)
        expect(mocks.toastInfo).toHaveBeenCalledWith("La sesión de soporte se cerró", expect.anything())
    })
})

describe("SupportConsole — tabla compartida con paginación del servidor", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.small = false
        mocks.params = new URLSearchParams()
        mocks.listClientUsers.mockResolvedValue([ANA])
    })

    it("Siguiente pide la página 2 con la misma búsqueda y deja la 1 a la vista mientras llega; el pie dice solo la página", async () => {
        let release!: (value: unknown) => void
        mocks.listClients
            .mockResolvedValueOnce({ items: [CLIENT], meta: { currentPage: 1, lastPage: 2, total: 30 } })
            .mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
        render(<SupportConsole />)
        await within(await screen.findByRole("table")).findByText("Casa Rentals252a2")
        // Sin «por página» del backend, el rango sería inventado: solo la página.
        expect(screen.queryByText(/Mostrando/)).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        await waitFor(() => expect(mocks.listClients).toHaveBeenLastCalledWith({ search: "", page: 2 }))
        expect(within(table()).getByText("Casa Rentals252a2")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled()
        release({ items: [INTERNAL], meta: { currentPage: 2, lastPage: 2, total: 30 } })
        expect(await within(table()).findByText("HiTGuest -")).toBeInTheDocument()
    })

    it("la fila del cliente abierto en el panel queda marcada", async () => {
        mocks.listClients.mockResolvedValue({ items: [CLIENT, INTERNAL], meta: { currentPage: 1, lastPage: 1, total: 2 } })
        render(<SupportConsole />)
        await screen.findByRole("table")
        fireEvent.click(within(table()).getByRole("button", { name: "Ver usuarios de Casa Rentals252a2" }))
        await screen.findByRole("dialog")
        // El panel es modal: lo de atrás queda oculto para el lector (`hidden: true`).
        const row = within(screen.getByRole("table", { hidden: true })).getByText("Casa Rentals252a2", { selector: "span" }).closest("tr")!
        expect(row).toHaveAttribute("data-state", "selected")
    })
})
