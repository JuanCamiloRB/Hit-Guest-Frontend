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
}))
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

/** jsdom no aplica CSS: tabla (md+) y tarjetas (móvil) conviven en el DOM; se consulta cada una por separado. */
const table = () => screen.getByRole("table")
const cards = () => screen.getAllByRole("list").find((list) => list.tagName === "UL")!

describe("SupportConsole — tabla a todo el ancho + panel lateral (auditorías 2026-10-16)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
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

    it("en móvil la misma información va en tarjetas, con su botón", async () => {
        render(<SupportConsole />)
        await screen.findByRole("table")
        const card = within(cards()).getByText("Casa Rentals252a2").closest("li")!
        expect(card).toHaveTextContent("ID 900123456")
        expect(within(card).getByRole("button", { name: "Ver usuarios de Casa Rentals252a2" })).toBeInTheDocument()
    })

    it("un cliente sin usuarios sigue legible pero no ofrece «Ver usuarios»", async () => {
        render(<SupportConsole />)
        const row = (await within(await screen.findByRole("table")).findByText("HiTGuest -")).closest("tr")!
        expect(within(row).getByText("Sin usuarios")).toBeInTheDocument()
        expect(within(row).queryByRole("button")).toBeNull()
        // Las iniciales ya no toman el guion: «HiTGuest -» → «H».
        expect(within(row).getByText("H")).toBeInTheDocument()
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
