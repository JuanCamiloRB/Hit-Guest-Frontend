import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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

describe("SupportConsole — tabla a todo el ancho + panel lateral (auditoría visual 2026-10-16)", () => {
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
        const row = (await screen.findByText("Casa Rentals252a2")).closest("tr")!
        expect(within(row).getAllByText("contacto@casa.test").length).toBeGreaterThan(0)
        expect(within(row).getByText("900123456")).toBeInTheDocument()
        expect(within(row).getByText("3 usuarios")).toBeInTheDocument()
    })

    it("un cliente sin usuarios se atenúa, no ofrece «Ver usuarios» y no abre nada", async () => {
        render(<SupportConsole />)
        const row = (await screen.findByText("HiTGuest -")).closest("tr")!
        expect(within(row).getByText("Sin usuarios")).toBeInTheDocument()
        expect(within(row).queryByRole("button")).toBeNull()
        fireEvent.click(row)
        expect(screen.queryByRole("dialog")).toBeNull()
        // Las iniciales ya no toman el guion: «HiTGuest -» → «H».
        expect(within(row).getByText("H")).toBeInTheDocument()
    })

    it("«Ver usuarios» abre el panel lateral con los usuarios de ese cliente", async () => {
        render(<SupportConsole />)
        fireEvent.click(await screen.findByRole("button", { name: "Ver usuarios de Casa Rentals252a2" }))
        const dialog = await screen.findByRole("dialog")
        expect(dialog).toHaveTextContent("Casa Rentals252a2")
        await waitFor(() => expect(mocks.listClientUsers).toHaveBeenCalledWith("c-1"))
        expect(await within(dialog).findByText("Ana Pérez")).toBeInTheDocument()
    })

    it("toda la fila también abre el panel", async () => {
        render(<SupportConsole />)
        fireEvent.click((await screen.findByText("Casa Rentals252a2")).closest("tr")!)
        expect(await screen.findByRole("dialog")).toBeInTheDocument()
    })

    it("al volver por una sesión cerrada, avisa", () => {
        mocks.params = new URLSearchParams("session=ended")
        render(<SupportConsole />)
        expect(mocks.toastInfo).toHaveBeenCalledWith("La sesión de soporte se cerró", expect.anything())
    })
})
