import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Home, Settings } from "lucide-react"

import { SIDEBAR_COOKIE_NAME, SIDEBAR_STORAGE_KEY, SidebarGroupLabel, SidebarItem, SidebarProvider, SidebarRoot, SidebarTrigger } from "./sidebar"
import { TooltipProvider } from "./tooltip"

// Radix Tooltip mide el disparador; jsdom no trae ResizeObserver.
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

function Demo({ collapsible = true, defaultCollapsed, onTrigger }: { collapsible?: boolean; defaultCollapsed?: boolean; onTrigger?: (event: React.MouseEvent) => void }) {
    return (
        <TooltipProvider delayDuration={0}>
            <SidebarProvider collapsible={collapsible} defaultCollapsed={defaultCollapsed}>
                <SidebarRoot id="lo-que-diga-el-consumidor">
                    <SidebarTrigger onClick={onTrigger} aria-label="nombre ajeno" />
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
        // La misma preferencia en la cookie, para que el servidor pinte la barra ya contraída.
        expect(document.cookie).toContain(`${SIDEBAR_COOKIE_NAME}=collapsed`)
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


describe("Sidebar (primitiva) — servidor y consumidores", () => {
    beforeEach(() => {
        window.localStorage.clear()
        document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`
    })

    it("defaultCollapsed (la cookie) manda cuando no hay nada en localStorage: nace contraída, sin salto", () => {
        render(<Demo defaultCollapsed />)
        const panel = screen.getByRole("complementary")
        expect(panel).toHaveAttribute("data-state", "collapsed")
        expect(panel.className).toContain("w-16")
        expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument()
    })

    it("localStorage gana sobre la cookie cuando ambos existen", () => {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "0")
        render(<Demo defaultCollapsed />)
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "expanded")
    })

    it("el consumidor no pisa lo que define al control: id del panel, nombre y toggle; su onClick se compone", async () => {
        const user = userEvent.setup()
        const onTrigger = vi.fn()
        render(<Demo onTrigger={onTrigger} />)
        const panel = screen.getByRole("complementary")
        const trigger = screen.getByRole("button", { name: "Contraer menú" })
        expect(screen.queryByRole("button", { name: "nombre ajeno" })).toBeNull()
        expect(panel.id).not.toBe("lo-que-diga-el-consumidor")
        expect(trigger).toHaveAttribute("aria-controls", panel.id)
        await user.click(trigger)
        expect(onTrigger).toHaveBeenCalledTimes(1)
        expect(panel).toHaveAttribute("data-state", "collapsed")
    })

    it("al montar, la cookie se pone de acuerdo con lo guardado en localStorage (sin pulsar nada)", () => {
        // Quien contrajo la barra antes de que existiera la cookie: el servidor la
        // pintaba ancha y el cliente la contraía en CADA carga.
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1")
        render(<Demo defaultCollapsed={false} />)
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "collapsed")
        expect(document.cookie).toContain(`${SIDEBAR_COOKIE_NAME}=collapsed`)
    })

    it("conmutar no recrea los enlaces: el mismo nodo <a> y el foco se conserva", async () => {
        render(<Demo />)
        const before = screen.getByRole("link", { name: "Propiedades" })
        before.focus()
        // Como un clic de ratón en Safari/Firefox: el disparador se activa sin recibir foco.
        await act(async () => { screen.getByRole("button", { name: "Contraer menú" }).click() })
        const after = screen.getByRole("link", { name: "Propiedades" })
        expect(after).toBe(before)
        expect(after).toHaveFocus()
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "collapsed")
    })

    it("ancha, enfocar un ítem NO muestra tooltip", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        // Disparador → Propiedades → Consola de soporte (ancha, el nombre incluye la marca visible).
        await user.tab(); await user.tab(); await user.tab()
        expect(screen.getByRole("link", { name: /Consola de soporte/ })).toHaveFocus()
        await new Promise((r) => setTimeout(r, 20))
        expect(screen.queryByRole("tooltip")).toBeNull()
    })

    it("un onClick externo con preventDefault evita el cambio", async () => {
        const user = userEvent.setup()
        render(<Demo onTrigger={(event) => event.preventDefault()} />)
        await user.click(screen.getByRole("button", { name: "Contraer menú" }))
        expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "expanded")
    })
})
