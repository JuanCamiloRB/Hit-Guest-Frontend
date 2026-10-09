import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: { user: null as Record<string, unknown> | null, isImpersonating: false },
    exit: vi.fn(),
}))
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => mocks.auth }))
vi.mock("../lib/impersonation-session", () => ({ exitImpersonatedAccount: mocks.exit }))

import { ImpersonationBanner } from "./ImpersonationBanner"

describe("ImpersonationBanner — siempre visible dentro de una cuenta ajena", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth = { user: null, isImpersonating: false }
    })

    it("fuera de una suplantación no pinta nada", () => {
        mocks.auth = { user: { firstName: "Soporte" }, isImpersonating: false }
        const { container } = render(<ImpersonationBanner />)
        expect(container).toBeEmptyDOMElement()
    })

    it("dice de quién es la cuenta, como quién, el modo y ofrece volver", () => {
        mocks.auth = {
            isImpersonating: true,
            user: {
                firstName: "Didier Van den Hove", clientName: "Pullman Miami SAS", isAccountOwner: true,
                impersonation: { id: "imp-1", mode: "read_only", expiresAt: "2026-10-09T16:04:00Z" },
            },
        }
        render(<ImpersonationBanner />)
        const region = screen.getByRole("region", { name: /dentro de la cuenta de otro usuario/ })
        expect(region).toHaveTextContent("Pullman Miami SAS")
        expect(region).toHaveTextContent("Didier Van den Hove")
        expect(region).toHaveTextContent("SOLO LECTURA")
        expect(region).toHaveTextContent(/Vence a las/)
        fireEvent.click(screen.getByRole("button", { name: /Volver a mi cuenta de superusuario/ }))
        expect(mocks.exit).toHaveBeenCalledOnce()
    })
})
