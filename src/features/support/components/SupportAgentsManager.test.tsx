import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"

const mocks = vi.hoisted(() => ({
    listAgents: vi.fn(),
    createAgent: vi.fn(),
    revokeAgent: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock("../services/support-service", () => ({ supportService: mocks }))

import { SupportAgentsManager, describeAgentCreateError } from "./SupportAgentsManager"

const LAURA = {
    uuid: "a-1", name: "Laura Gómez", email: "laura.soporte@hitguest.test", createdAt: "2026-10-10T17:13:37-05:00",
    activeSession: { uuid: "s-1", clientName: "Casa Rentals252a2", userName: "Ana Pérez" },
}

describe("describeAgentCreateError — errores del contrato §7", () => {
    it("422 por campo va a su campo", () => {
        expect(describeAgentCreateError(new ApiError(422, {
            message: "x", errors: { email: ["This email belongs to a client account and cannot be a support agent."] },
        }))).toEqual({ name: undefined, email: "This email belongs to a client account and cannot be a support agent." })
    })

    it("SUPPORT_INTERNAL_CLIENT_NOT_CONFIGURED muestra el mensaje del backend", () => {
        expect(describeAgentCreateError(new ApiError(422, {
            message: "The internal support client is not configured.", code: "SUPPORT_INTERNAL_CLIENT_NOT_CONFIGURED",
        })).form).toBe("The internal support client is not configured.")
    })
})

describe("SupportAgentsManager — lista, alta y revocación (contrato §8)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listAgents.mockResolvedValue({ items: [LAURA], meta: { currentPage: 1, lastPage: 1, total: 1 } })
    })

    it("muestra la sesión abierta de cada agente", async () => {
        render(<SupportAgentsManager />)
        expect(await screen.findByText("En sesión: Casa Rentals252a2 como Ana Pérez")).toBeInTheDocument()
    })

    it("da de alta con nombre y correo y refresca la lista", async () => {
        mocks.createAgent.mockResolvedValue({ ...LAURA, uuid: "a-2", name: "Pedro" })
        render(<SupportAgentsManager />)
        fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: " Pedro " } })
        fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "pedro@hit.tools" } })
        fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))

        await waitFor(() => expect(mocks.createAgent).toHaveBeenCalledWith({ name: "Pedro", email: "pedro@hit.tools" }))
        await waitFor(() => expect(mocks.listAgents).toHaveBeenCalledTimes(2))
    })

    it("un 422 de correo aparece bajo el campo", async () => {
        mocks.createAgent.mockRejectedValue(new ApiError(422, { message: "x", errors: { email: ["The email field must be a valid email address."] } }))
        render(<SupportAgentsManager />)
        fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Pedro" } })
        fireEvent.click(screen.getByRole("button", { name: "Dar de alta" }))
        expect(await screen.findByText("The email field must be a valid email address.")).toBeInTheDocument()
    })

    it("revocar pide confirmación y después llama al backend", async () => {
        mocks.revokeAgent.mockResolvedValue(undefined)
        render(<SupportAgentsManager />)
        fireEvent.click(await screen.findByRole("button", { name: /Revocar/ }))
        expect(mocks.revokeAgent).not.toHaveBeenCalled()
        expect(screen.getByRole("alertdialog")).toHaveTextContent("Se cerrará su sesión de soporte abierta")

        fireEvent.click(screen.getByRole("button", { name: "Revocar acceso" }))
        await waitFor(() => expect(mocks.revokeAgent).toHaveBeenCalledWith("a-1"))
    })
})
