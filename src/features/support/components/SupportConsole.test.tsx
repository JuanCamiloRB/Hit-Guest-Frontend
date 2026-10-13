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
const USERS = [
    { uuid: "u-1", name: "Ana Pérez", email: "ana@casa.test", role: "property_manager", isAccountOwner: true, verified: true, canOpenSession: true },
    { uuid: "u-3", name: "Carla Sin Verificar", email: "carla@casa.test", role: "read_only", isAccountOwner: false, verified: false, canOpenSession: false },
]

describe("SupportConsole — buscar cliente, elegir usuario, entrar (contrato §4)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.params = new URLSearchParams()
        mocks.listClients.mockResolvedValue({ items: [CLIENT], meta: { currentPage: 1, lastPage: 1, total: 1 } })
        mocks.listClientUsers.mockResolvedValue(USERS)
    })

    it("busca con el texto escrito y muestra nombre, correo, identificación y usuarios", async () => {
        render(<SupportConsole />)
        fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "Rentals" } })
        fireEvent.submit(screen.getByRole("search"))

        await waitFor(() => expect(mocks.listClients).toHaveBeenLastCalledWith({ search: "Rentals", page: 1 }))
        const row = await screen.findByRole("button", { name: /Casa Rentals252a2/ })
        expect(row).toHaveTextContent("contacto@casa.test · 900123456")
        expect(row).toHaveTextContent("3 usuarios")
    })

    it("al elegir un cliente lista sus usuarios; el que no se puede abrir queda deshabilitado y explicado", async () => {
        render(<SupportConsole />)
        fireEvent.click(await screen.findByRole("button", { name: /Casa Rentals252a2/ }))

        await waitFor(() => expect(mocks.listClientUsers).toHaveBeenCalledWith("c-1"))
        expect(await screen.findByRole("button", { name: "Entrar como Ana Pérez" })).toBeEnabled()
        expect(screen.getByRole("button", { name: "Entrar como Carla Sin Verificar" })).toBeDisabled()
        expect(screen.getByText(/no ha verificado su correo o es personal de HIT/)).toBeInTheDocument()
        expect(within(screen.getByText("Ana Pérez").closest("li")!).getByText("Dueño")).toBeInTheDocument()
    })

    it("el icono de entrar abre el diálogo del motivo para ese usuario", async () => {
        render(<SupportConsole />)
        fireEvent.click(await screen.findByRole("button", { name: /Casa Rentals252a2/ }))
        fireEvent.click(await screen.findByRole("button", { name: "Entrar como Ana Pérez" }))
        expect(await screen.findByRole("dialog")).toHaveTextContent("Entrar a la cuenta de Casa Rentals252a2")
    })

    it("al volver por una sesión cerrada, avisa", () => {
        mocks.params = new URLSearchParams("session=ended")
        render(<SupportConsole />)
        expect(mocks.toastInfo).toHaveBeenCalledWith("La sesión de soporte se cerró", expect.anything())
    })
})
