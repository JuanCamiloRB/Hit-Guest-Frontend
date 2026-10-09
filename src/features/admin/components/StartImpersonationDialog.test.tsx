import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"

const mocks = vi.hoisted(() => ({ start: vi.fn(), enter: vi.fn() }))
vi.mock("../services/admin-service", () => ({ adminService: { startImpersonation: mocks.start } }))
vi.mock("../lib/impersonation-session", () => ({ enterImpersonatedAccount: mocks.enter }))

import { StartImpersonationDialog, impersonationReasonError } from "./StartImpersonationDialog"

const target = { uuid: "u-1", name: "Didier Van den Hove", email: "didier@x.com", isAccountOwner: true }
const REASON = "Ticket HG-1234: revisar reservas"

function renderDialog(canWrite = false) {
    return render(
        <StartImpersonationDialog open onOpenChange={vi.fn()} target={target} clientName="Pullman Miami SAS" canWrite={canWrite} />,
    )
}

describe("StartImpersonationDialog — motivo obligatorio y modo según la capacidad", () => {
    beforeEach(() => vi.clearAllMocks())

    it("el motivo va de 10 a 500 caracteres", () => {
        expect(impersonationReasonError("corto")).toMatch(/al menos 10/)
        expect(impersonationReasonError("x".repeat(501))).toMatch(/500/)
        expect(impersonationReasonError(REASON)).toBeNull()
    })

    it("sin motivo válido no llama al backend", async () => {
        renderDialog()
        fireEvent.click(screen.getByRole("button", { name: /Entrar a la cuenta/ }))
        expect(await screen.findByText(/al menos 10 caracteres/)).toBeInTheDocument()
        expect(mocks.start).not.toHaveBeenCalled()
    })

    it("sin la capacidad de escritura no ofrece el modo y entra en solo lectura", async () => {
        mocks.start.mockResolvedValue({ id: "imp-1", token: "t", mode: "read_only", user: {} })
        renderDialog(false)
        expect(screen.queryByRole("radio", { name: /Con escritura/ })).toBeNull()
        fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: REASON } })
        fireEvent.click(screen.getByRole("button", { name: /Entrar a la cuenta/ }))
        await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({ userUuid: "u-1", mode: "read_only", reason: REASON }))
        expect(mocks.enter).toHaveBeenCalledOnce()
    })

    it("con la capacidad de escritura deja elegirla y la envía", async () => {
        mocks.start.mockResolvedValue({ id: "imp-1", token: "t", mode: "full", user: {} })
        renderDialog(true)
        fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: REASON } })
        fireEvent.click(screen.getByRole("radio", { name: /Con escritura/ }))
        fireEvent.click(screen.getByRole("button", { name: /Entrar a la cuenta/ }))
        await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ mode: "full" })))
    })

    it("un rechazo documentado muestra su propio mensaje y no entra", async () => {
        mocks.start.mockRejectedValue(new ApiError(409, { message: "Conflict", code: "TARGET_USER_INACTIVE" }))
        renderDialog()
        fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: REASON } })
        fireEvent.click(screen.getByRole("button", { name: /Entrar a la cuenta/ }))
        expect(await screen.findByRole("alert")).toHaveTextContent("Ese usuario está inactivo o fue eliminado.")
        expect(mocks.enter).not.toHaveBeenCalled()
    })
})
