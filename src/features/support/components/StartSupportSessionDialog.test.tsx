import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"

const mocks = vi.hoisted(() => ({ start: vi.fn(), enter: vi.fn() }))
vi.mock("../services/support-service", () => ({ supportService: { startSession: mocks.start } }))
vi.mock("../lib/support-session", () => ({ enterSupportSession: mocks.enter }))

import { StartSupportSessionDialog, supportReasonError } from "./StartSupportSessionDialog"

const target = { uuid: "u-1", name: "Ana Pérez", email: "ana@casa.test", isAccountOwner: true }
const REASON = "Ticket 77: revisar contrato"

function renderDialog(onUserGone = vi.fn()) {
    render(
        <StartSupportSessionDialog open onOpenChange={vi.fn()} target={target} clientName="Casa Rentals252a2" onUserGone={onUserGone} />,
    )
    return { onUserGone }
}

async function submitWith(reason: string) {
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: reason } })
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }))
}

describe("StartSupportSessionDialog — motivo y errores del contrato §7", () => {
    beforeEach(() => vi.clearAllMocks())

    it("el motivo pide al menos 10 caracteres (sin un máximo inventado)", () => {
        expect(supportReasonError("corto")).toMatch(/al menos 10/)
        expect(supportReasonError(REASON)).toBeNull()
        expect(supportReasonError("x".repeat(2000))).toBeNull()
    })

    it("avisa que la sesión tiene los permisos del usuario y queda a su nombre", () => {
        renderDialog()
        expect(screen.getByText(/con sus mismos permisos/)).toBeInTheDocument()
        expect(screen.getByText(/queda a su nombre/)).toBeInTheDocument()
    })

    it("sin motivo válido no llama al backend", async () => {
        renderDialog()
        await submitWith("corto")
        expect(mocks.start).not.toHaveBeenCalled()
        expect(screen.getByText(/al menos 10/)).toBeInTheDocument()
    })

    it("con motivo válido abre la sesión y entra", async () => {
        const started = { token: "tok", session: { uuid: "s-1" }, user: { uuid: "u-1" } }
        mocks.start.mockResolvedValue(started)
        renderDialog()
        await submitWith(`  ${REASON}  `)
        await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({ userUuid: "u-1", reason: REASON }))
        expect(mocks.enter).toHaveBeenCalledWith(started)
    })

    it("422 en errors.reason se muestra bajo el campo", async () => {
        mocks.start.mockRejectedValue(new ApiError(422, {
            message: "Describe why…",
            errors: { reason: ["Describe why you need to access this account (at least 10 characters)."] },
        }))
        renderDialog()
        await submitWith(REASON)
        expect(await screen.findByText(/Describe why you need to access/)).toHaveAttribute("id", "support-reason-help")
    })

    it("422 en errors.userUuid avisa y pide refrescar la lista de usuarios", async () => {
        mocks.start.mockRejectedValue(new ApiError(422, { message: "x", errors: { userUuid: ["The selected user is invalid."] } }))
        const { onUserGone } = renderDialog()
        await submitWith(REASON)
        expect(await screen.findByRole("alert")).toHaveTextContent("The selected user is invalid.")
        expect(onUserGone).toHaveBeenCalledOnce()
    })

    it("403 SUPPORT_TARGET_NOT_ALLOWED muestra el mensaje del backend", async () => {
        mocks.start.mockRejectedValue(new ApiError(403, {
            message: "A support session cannot be opened as this user.", code: "SUPPORT_TARGET_NOT_ALLOWED",
        }))
        renderDialog()
        await submitWith(REASON)
        expect(await screen.findByRole("alert")).toHaveTextContent("A support session cannot be opened as this user.")
    })

    it("429 pide esperar", async () => {
        mocks.start.mockRejectedValue(new ApiError(429, { message: "Too Many Attempts." }))
        renderDialog()
        await submitWith(REASON)
        expect(await screen.findByRole("alert")).toHaveTextContent("Espera un momento e intenta de nuevo.")
    })
})
