import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ cookies: new Map<string, string>() }))

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (mocks.cookies.has(name) ? { name, value: mocks.cookies.get(name)! } : undefined),
        getAll: () => Array.from(mocks.cookies, ([name, value]) => ({ name, value })),
    }),
}))
// El cascarón, no sus pantallas: lo que importa es qué recibe la barra desde el servidor.
vi.mock("./Sidebar", () => ({ Sidebar: () => <nav aria-label="Navegación principal" /> }))
vi.mock("./Header", () => ({ Header: () => <header /> }))
vi.mock("@/features/billing/components/BalanceBanner", () => ({ BalanceBanner: () => null }))
vi.mock("@/features/support/components/SupportSessionBanner", () => ({ SupportSessionBanner: () => null }))
vi.mock("@/features/support/components/SupportAgentRouteGuard", () => ({
    AccountChromeOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SupportAgentRouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import AdminLayout from "./AdminLayout"
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-preference"

async function renderLayout() {
    // Componente de servidor asíncrono: se resuelve su JSX y se pinta.
    const tree = await AdminLayout({ children: <p>contenido</p> })
    render(tree)
}

describe("AdminLayout — la barra nace como dice la cookie (sin salto al hidratar)", () => {
    it("con `hitguest_sidebar=collapsed` el primer render ya es contraído", async () => {
        mocks.cookies.set(SIDEBAR_COOKIE_NAME, "collapsed")
        await renderLayout()
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "collapsed")
        mocks.cookies.clear()
    })

    it("sin cookie, ancha", async () => {
        await renderLayout()
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "expanded")
    })
})
