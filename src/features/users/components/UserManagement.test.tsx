import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/features/auth/types"

const mocks = vi.hoisted(() => ({ getUsers: vi.fn(), deleteUser: vi.fn() }))
vi.mock("../services/user-service", () => ({
    userService: { getUsers: mocks.getUsers, deleteUser: mocks.deleteUser, createUser: vi.fn() },
}))
vi.mock("./TransferOwnershipDialog", () => ({ TransferOwnershipDialog: () => null }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useAuthStore } from "@/lib/store/auth-store"
import { resetUsersCache } from "../lib/users-cache"
import { UserManagement } from "./UserManagement"

const user = (id: string, firstName: string) => ({ id, uuid: id, firstName, email: `${id}@example.com`, role: "property_staff", clientId: "c1" } as unknown as User)

describe("UserManagement — la lista de usuarios con caché", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetUsersCache()
        vi.spyOn(console, "error").mockImplementation(() => {})
        useAuthStore.setState({ user: { ...user("me", "Camila"), isAccountOwner: true, clientUuid: "c1" } as unknown as User })
    })

    it("carga y muestra los usuarios", async () => {
        mocks.getUsers.mockResolvedValue([user("u1", "Ana")])
        render(<UserManagement />)
        expect(await screen.findByText("Ana")).toBeInTheDocument()
    })

    it("sin lista y con fallo: lo dice con Reintentar, nunca «no hay usuarios»", async () => {
        mocks.getUsers.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([user("u1", "Ana")])
        render(<UserManagement />)

        expect(await screen.findByText("No pudimos cargar los usuarios")).toBeInTheDocument()
        expect(screen.getByText("503")).toBeInTheDocument()
        expect(screen.queryByText(/No hay usuarios registrados/)).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(await screen.findByText("Ana")).toBeInTheDocument()
    })

    it("volver a la pestaña muestra la lista al instante y la refresca detrás", async () => {
        mocks.getUsers.mockResolvedValue([user("u1", "Ana")])
        const first = render(<UserManagement />)
        await screen.findByText("Ana")
        first.unmount()

        let release!: (value: User[]) => void
        mocks.getUsers.mockReturnValueOnce(new Promise<User[]>((res) => { release = res }))
        render(<UserManagement />)
        expect(screen.getByText("Ana")).toBeInTheDocument()

        await act(async () => release([user("u1", "Ana"), user("u2", "Luis")]))
        expect(await screen.findByText("Luis")).toBeInTheDocument()
    })

    it("si una actualización falla, conserva la lista y avisa", async () => {
        mocks.getUsers.mockResolvedValueOnce([user("u1", "Ana")]).mockRejectedValueOnce(new Error("503"))
        const first = render(<UserManagement />)
        await screen.findByText("Ana")
        first.unmount()

        render(<UserManagement />)
        expect(await screen.findByText(/No pudimos actualizar la lista/)).toBeInTheDocument()
        expect(screen.getByText("Ana")).toBeInTheDocument()
        await waitFor(() => expect(mocks.getUsers).toHaveBeenCalledTimes(2))
    })

    it("eliminar quita la fila en el acto y vuelve a pedir la lista", async () => {
        mocks.getUsers.mockResolvedValueOnce([user("u1", "Ana"), user("u2", "Luis")])
        let release!: (value: User[]) => void
        mocks.getUsers.mockReturnValueOnce(new Promise<User[]>((res) => { release = res }))
        mocks.deleteUser.mockResolvedValue(undefined)
        vi.spyOn(window, "confirm").mockReturnValue(true)
        render(<UserManagement />)
        await screen.findByText("Luis")

        fireEvent.keyDown(screen.getByRole("button", { name: "Acciones para Luis" }), { key: "Enter" })
        fireEvent.click(await screen.findByRole("menuitem", { name: /Eliminar/ }))

        await waitFor(() => expect(screen.queryByText("Luis")).toBeNull())
        expect(mocks.deleteUser).toHaveBeenCalledWith("u2")
        expect(mocks.getUsers).toHaveBeenCalledTimes(2)
        await act(async () => release([user("u1", "Ana")]))
    })
})
