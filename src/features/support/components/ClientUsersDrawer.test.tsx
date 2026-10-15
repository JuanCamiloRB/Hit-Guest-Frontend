import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"

const mocks = vi.hoisted(() => ({ listClientUsers: vi.fn(), start: vi.fn(), enter: vi.fn() }))
vi.mock("../services/support-service", () => ({
    supportService: { listClientUsers: mocks.listClientUsers, startSession: mocks.start },
}))
vi.mock("../lib/support-session", () => ({ enterSupportSession: mocks.enter }))

import { ClientUsersDrawer } from "./ClientUsersDrawer"
import { defaultSupportUser, supportReasonError } from "../lib/start-session"

const CLIENT = { uuid: "c-1", name: "Casa Rentals252a2", email: "contacto@casa.test", identificationNumber: "900123456", usersCount: 3 }
const ANA = { uuid: "u-1", name: "Ana Pérez", email: "ana@casa.test", role: "property_manager", isAccountOwner: true, verified: true, canOpenSession: true }
const BETO = { uuid: "u-2", name: "Beto Staff", email: "beto@casa.test", role: "property_staff", isAccountOwner: false, verified: true, canOpenSession: true }
const CARLA = { uuid: "u-3", name: "Carla Sin Verificar", email: "carla@casa.test", role: "read_only", isAccountOwner: false, verified: false, canOpenSession: false }
const REASON = "Ticket 77: revisar contrato"

function renderDrawer(onClose = vi.fn()) {
    render(<ClientUsersDrawer client={CLIENT} onClose={onClose} />)
    return { onClose }
}

async function writeReasonAndEnter(name: RegExp) {
    fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: REASON } })
    fireEvent.click(screen.getByRole("button", { name }))
}

describe("ClientUsersDrawer — todo el flujo en un solo panel (contrato §4)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listClientUsers.mockResolvedValue([ANA, CARLA])
    })

    it("muestra el cliente, el aviso de permisos y sus usuarios", async () => {
        renderDrawer()
        const dialog = await screen.findByRole("dialog")
        expect(dialog).toHaveTextContent("Casa Rentals252a2")
        expect(dialog).toHaveTextContent("contacto@casa.test · ID 900123456")
        expect(dialog).toHaveTextContent("Entrarás con los mismos permisos del usuario")
        expect(await screen.findByText("Ana Pérez")).toBeInTheDocument()
    })

    it("con un solo usuario habilitado ya viene elegido, y el bloqueado no se puede elegir", async () => {
        renderDrawer()
        expect(await screen.findByRole("radio", { name: /Ana Pérez/ })).toBeChecked()
        expect(screen.getByRole("radio", { name: /Carla Sin Verificar/ })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Entrar como Ana Pérez" })).toBeEnabled()
    })

    it("con varios habilitados pide elegir antes de entrar", async () => {
        mocks.listClientUsers.mockResolvedValue([ANA, BETO])
        renderDrawer()
        expect(await screen.findByRole("button", { name: "Elige un usuario" })).toBeDisabled()
        fireEvent.click(screen.getByRole("radio", { name: /Beto Staff/ }))
        expect(screen.getByRole("button", { name: "Entrar como Beto Staff" })).toBeEnabled()
    })

    it("con motivo válido abre la sesión como el usuario elegido, sin un segundo diálogo", async () => {
        const started = { token: "tok", session: { uuid: "s-1" }, user: { uuid: "u-1" } }
        mocks.start.mockResolvedValue(started)
        renderDrawer()
        await writeReasonAndEnter(/Entrar como Ana Pérez/)
        await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({ userUuid: "u-1", reason: REASON }))
        expect(mocks.enter).toHaveBeenCalledWith(started)
        expect(screen.getAllByRole("dialog")).toHaveLength(1)
    })

    it("sin motivo válido no llama al backend", async () => {
        renderDrawer()
        fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: "corto" } })
        fireEvent.click(screen.getByRole("button", { name: /Entrar como Ana Pérez/ }))
        expect(mocks.start).not.toHaveBeenCalled()
        expect(screen.getByText(/al menos 10/)).toBeInTheDocument()
    })

    it("422 en errors.reason va bajo el campo", async () => {
        mocks.start.mockRejectedValue(new ApiError(422, { message: "x", errors: { reason: ["Describe why you need to access this account (at least 10 characters)."] } }))
        renderDrawer()
        await writeReasonAndEnter(/Entrar como Ana Pérez/)
        expect(await screen.findByText(/Describe why you need to access/)).toHaveAttribute("id", "support-reason-help")
    })

    it("422 en errors.userUuid avisa y vuelve a cargar los usuarios", async () => {
        mocks.start.mockRejectedValue(new ApiError(422, { message: "x", errors: { userUuid: ["The selected user is invalid."] } }))
        renderDrawer()
        await writeReasonAndEnter(/Entrar como Ana Pérez/)
        await waitFor(() => expect(mocks.listClientUsers).toHaveBeenCalledTimes(2))
    })

    it("403 SUPPORT_TARGET_NOT_ALLOWED y 429 muestran su mensaje", async () => {
        mocks.start.mockRejectedValueOnce(new ApiError(403, { message: "A support session cannot be opened as this user.", code: "SUPPORT_TARGET_NOT_ALLOWED" }))
        renderDrawer()
        await writeReasonAndEnter(/Entrar como Ana Pérez/)
        expect(await screen.findByRole("alert")).toHaveTextContent("A support session cannot be opened as this user.")

        mocks.start.mockRejectedValueOnce(new ApiError(429, { message: "Too Many Attempts." }))
        fireEvent.click(screen.getByRole("button", { name: /Entrar como Ana Pérez/ }))
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Espera un momento e intenta de nuevo."))
    })

    it("el error al cargar usuarios queda dentro del panel con Reintentar", async () => {
        mocks.listClientUsers.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([ANA])
        renderDrawer()
        fireEvent.click(await screen.findByRole("button", { name: /Reintentar/ }))
        expect(await screen.findByText("Ana Pérez")).toBeInTheDocument()
    })

    it("se cierra con el botón visible", async () => {
        const { onClose } = renderDrawer()
        fireEvent.click(await screen.findByRole("button", { name: "Cerrar" }))
        expect(onClose).toHaveBeenCalled()
    })
})

describe("start-session — reglas puras", () => {
    it("el motivo pide al menos 10 caracteres, sin un máximo inventado", () => {
        expect(supportReasonError("corto")).toMatch(/al menos 10/)
        expect(supportReasonError(REASON)).toBeNull()
        expect(supportReasonError("x".repeat(2000))).toBeNull()
    })

    it("elige por defecto solo cuando hay exactamente un usuario habilitado", () => {
        expect(defaultSupportUser([ANA, CARLA])).toBe("u-1")
        expect(defaultSupportUser([ANA, BETO])).toBeNull()
        expect(defaultSupportUser([CARLA])).toBeNull()
    })
})
