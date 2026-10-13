import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"

const mocks = vi.hoisted(() => ({
    auth: { user: null as Record<string, unknown> | null, isInSupportSession: false },
    exit: vi.fn(),
    leave: vi.fn(),
    current: vi.fn(),
    update: vi.fn(),
}))
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => mocks.auth }))
vi.mock("@/hooks/useHasHydrated", () => ({ useHasHydrated: () => true }))
vi.mock("@/lib/store/auth-store", () => ({ useAuthStore: { getState: () => ({ updateSupportSession: mocks.update }) } }))
vi.mock("../lib/support-session", () => ({ exitSupportSession: mocks.exit, leaveEndedSupportSession: mocks.leave }))
vi.mock("../services/support-service", () => ({ supportService: { getCurrentSession: mocks.current } }))

import { SupportSessionBanner } from "./SupportSessionBanner"

const SESSION = { uuid: "s-1", clientName: "Casa Rentals252a2", userName: "Ana Pérez", userEmail: "ana@casa.test", idleTimeoutMinutes: 60 }

describe("SupportSessionBanner — franja del modo soporte (contrato §6)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth = { user: null, isInSupportSession: false }
        mocks.current.mockResolvedValue(SESSION)
    })

    it("fuera del modo soporte no pinta nada ni consulta la sesión", () => {
        mocks.auth = { user: { firstName: "Laura" }, isInSupportSession: false }
        const { container } = render(<SupportSessionBanner />)
        expect(container).toBeEmptyDOMElement()
        expect(mocks.current).not.toHaveBeenCalled()
    })

    it("dice de quién es la cuenta, como quién, el cierre que manda el backend, y ofrece salir", async () => {
        mocks.auth = { isInSupportSession: true, user: { firstName: "Ana Pérez", supportSession: SESSION } }
        render(<SupportSessionBanner />)
        const region = screen.getByRole("region", { name: "Modo soporte" })
        expect(region).toHaveTextContent("Casa Rentals252a2")
        expect(region).toHaveTextContent("Ana Pérez (ana@casa.test)")
        expect(region).toHaveTextContent("Se cierra tras 60 min sin actividad")

        fireEvent.click(screen.getByRole("button", { name: "Salir" }))
        expect(mocks.exit).toHaveBeenCalledOnce()
        await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(SESSION))
    })

    it("sin idleTimeoutMinutes no inventa un plazo", () => {
        mocks.auth = { isInSupportSession: true, user: { firstName: "Ana", supportSession: { ...SESSION, idleTimeoutMinutes: null } } }
        render(<SupportSessionBanner />)
        expect(screen.getByRole("region", { name: "Modo soporte" })).not.toHaveTextContent("min sin actividad")
    })

    it("tras recargar, un 404 SUPPORT_SESSION_NOT_FOUND sale del modo soporte localmente", async () => {
        mocks.current.mockRejectedValue(new ApiError(404, { message: "Not a support token.", code: "SUPPORT_SESSION_NOT_FOUND" }))
        mocks.auth = { isInSupportSession: true, user: { firstName: "Ana", supportSession: SESSION } }
        render(<SupportSessionBanner />)
        await waitFor(() => expect(mocks.leave).toHaveBeenCalledOnce())
    })
})
