import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: { user: null as Record<string, unknown> | null, isInSupportSession: false },
    pathname: "/dashboard",
    replace: vi.fn(),
}))
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => mocks.auth }))
vi.mock("@/hooks/useHasHydrated", () => ({ useHasHydrated: () => true }))
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ replace: mocks.replace }) }))

import { AccountChromeOnly, SupportAgentRouteGuard } from "./SupportAgentRouteGuard"

const AGENT = { firstName: "Laura", canAccessSupportConsole: true, canManageSupportAgents: false }

function renderGuard() {
    return render(
        <>
            <AccountChromeOnly><p>saldo de la cuenta</p></AccountChromeOnly>
            <SupportAgentRouteGuard><p>página del panel</p></SupportAgentRouteGuard>
        </>,
    )
}

describe("SupportAgentRouteGuard — el agente puro no entra al panel normal (contrato §5b)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth = { user: AGENT, isInSupportSession: false }
        mocks.pathname = "/dashboard"
    })

    it.each(["/dashboard", "/dashboard/settings", "/dashboard/reservations/abc"])(
        "%s: lo devuelve a la consola sin montar la página ni el saldo",
        (path) => {
            mocks.pathname = path
            renderGuard()
            expect(mocks.replace).toHaveBeenCalledWith("/dashboard/support")
            expect(screen.queryByText("página del panel")).toBeNull()
            expect(screen.queryByText("saldo de la cuenta")).toBeNull()
        },
    )

    it.each(["/dashboard/support", "/dashboard/support/agents"])("%s: la deja pasar", (path) => {
        mocks.pathname = path
        renderGuard()
        expect(mocks.replace).not.toHaveBeenCalled()
        expect(screen.getByText("página del panel")).toBeInTheDocument()
    })

    it("en modo soporte el agente usa el panel del cliente con normalidad", () => {
        mocks.auth = { user: { firstName: "Ana", canAccessSupportConsole: false }, isInSupportSession: true }
        renderGuard()
        expect(mocks.replace).not.toHaveBeenCalled()
        expect(screen.getByText("página del panel")).toBeInTheDocument()
        expect(screen.getByText("saldo de la cuenta")).toBeInTheDocument()
    })

    it("super_admin y PM no se redirigen", () => {
        for (const user of [{ canAccessSupportConsole: true, canManageSupportAgents: true }, { isAccountOwner: true }]) {
            mocks.auth = { user, isInSupportSession: false }
            const { unmount } = renderGuard()
            expect(screen.getByText("página del panel")).toBeInTheDocument()
            unmount()
        }
        expect(mocks.replace).not.toHaveBeenCalled()
    })
})
