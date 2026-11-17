import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Home, Settings } from "lucide-react"

import { SIDEBAR_STORAGE_KEY, SidebarGroupLabel, SidebarItem, SidebarProvider, SidebarRoot, SidebarTrigger } from "./sidebar"
import { TooltipProvider } from "./tooltip"

// Radix Tooltip mide el disparador; jsdom no trae ResizeObserver.
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

function Demo({ collapsible = true }: { collapsible?: boolean }) {
    return (
        <TooltipProvider delayDuration={0}>
            <SidebarProvider collapsible={collapsible}>
                <SidebarRoot>
                    <SidebarTrigger />
                    <nav aria-label="Principal">
                        <ul>
                            <SidebarItem href="/dashboard/properties" icon={Home} label="Propiedades" active />
                            <SidebarItem href="/dashboard/support" icon={Settings} label="Consola de soporte" badge="HIT" />
                        </ul>
                    </nav>
                    <SidebarGroupLabel>Sistema</SidebarGroupLabel>
                </SidebarRoot>
            </SidebarProvider>
        </TooltipProvider>
    )
}

describe("Sidebar (primitiva) — contraer y expandir", () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it("arranca ancha; el disparador la contrae, la guarda, y los ítems conservan su nombre", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        const panel = screen.getByRole("complementary")
        expect(panel).toHaveAttribute("data-state", "expanded")
        expect(panel.className).toContain("w-64")
        expect(screen.getByText("Sistema")).toBeInTheDocument()
        expect(screen.getByText("HIT")).toBeInTheDocument()

        const trigger = screen.getByRole("button", { name: "Contraer menú" })
        expect(trigger).toHaveAttribute("aria-expanded", "true")
        expect(trigger).toHaveAttribute("aria-controls", panel.id)
        await user.click(trigger)

        expect(panel).toHaveAttribute("data-state", "collapsed")
        expect(panel.className).toContain("w-16")
        expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("1")
        expect(screen.getByRole("button", { name: "Expandir menú" })).toHaveAttribute("aria-expanded", "false")
        // Nombre accesible intacto (texto sr-only); el rótulo del grupo y la marca ya no se ven.
        expect(screen.getByRole("link", { name: "Propiedades" })).toHaveAttribute("aria-current", "page")
        expect(screen.getByRole("link", { name: "Consola de soporte" })).toBeInTheDocument()
        expect(screen.queryByText("Sistema")).toBeNull()
        expect(screen.queryByText("HIT")).toBeNull()
    })

    it("contraída, enfocar un ítem muestra su nombre en un tooltip (con la marca)", async () => {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1")
        const user = userEvent.setup()
        render(<Demo />)
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "collapsed")
        await user.tab()
        await user.tab()
        await user.tab()
        expect(screen.getByRole("link", { name: "Consola de soporte" })).toHaveFocus()
        const tooltip = await screen.findByRole("tooltip")
        expect(tooltip).toHaveTextContent("Consola de soporte · HIT")
    })

    it("la preferencia guardada se respeta al cargar y se puede volver a expandir", async () => {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1")
        const user = userEvent.setup()
        render(<Demo />)
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "collapsed")
        await user.click(screen.getByRole("button", { name: "Expandir menú" }))
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "expanded")
        expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("0")
    })

    it("collapsible={false}: siempre ancha y sin disparador, aunque haya preferencia guardada", () => {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1")
        render(<Demo collapsible={false} />)
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "expanded")
        expect(screen.queryByRole("button", { name: /menú/ })).toBeNull()
        expect(within(screen.getByRole("navigation")).getByText("Propiedades")).toBeVisible()
    })
})
