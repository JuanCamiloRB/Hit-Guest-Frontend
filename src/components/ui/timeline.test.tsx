import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const media = vi.hoisted(() => ({ touch: false, calls: 0 }))
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: (q: string) => { media.calls += 1; return q === "(hover: none)" && media.touch } }))

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

import { Timeline, TimelineBar, TimelineLegend, TimelineRow } from "./timeline"

// Radix Tooltip mide el disparador; jsdom no trae ResizeObserver.
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

// Lunes 16 nov 2026 a domingo 22 nov: el sábado y el domingo son fin de semana.
const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 16 + i))
const today = new Date(2026, 10, 18)

function board(bar: Partial<React.ComponentProps<typeof TimelineBar>> = {}) {
    return (
        <Timeline days={days} today={today} label="Ocupación" resourceLabel="1 alojamiento" footer="Mostrando 1 de 1" footerNote="Las barras terminan en la fecha de checkout">
            <TimelineRow title="704 Casa Roma" subtitle="Nomad House">
                <TimelineBar start={0.5} end={2.5} href="/r/1" label="Kayla, 704 Casa Roma: check-in 16 nov 2026, checkout 18 nov 2026, 2 noches"
                    checkin checkout detailTitle="Kayla" details={[["Check-in", "16 nov 2026"], ["Duración", "2 noches"]]} {...bar}>
                    Kayla · 2 noches
                </TimelineBar>
            </TimelineRow>
        </Timeline>
    )
}

describe("Timeline", () => {
    beforeEach(() => { media.touch = false; media.calls = 0 })

    it("región con nombre, columna de recursos, días con hoy en primary y el fin de semana teñido; pie con la nota", () => {
        const { container } = render(board())
        expect(screen.getByRole("region", { name: "Ocupación" })).toBeInTheDocument()
        expect(container.querySelector('[data-slot="timeline-resource-head"]')).toHaveClass("bg-table-head-accent", "sticky")
        const heads = container.querySelectorAll('[data-slot="timeline-day"]')
        expect(heads).toHaveLength(7)
        expect(heads[2]).toHaveAttribute("data-today", "true")
        expect(heads[2]).toHaveClass("bg-primary", "text-primary-foreground")
        expect(heads[5]).toHaveAttribute("data-weekend", "true")
        expect(heads[5]).toHaveClass("bg-table-head-accent", "text-primary-hover")
        expect(heads[0]).toHaveTextContent("lun16")
        expect(screen.getByText("Las barras terminan en la fecha de checkout")).toBeInTheDocument()
        expect(screen.getByText("Nomad House")).toHaveClass("text-ink-3")
        // La columna de recursos no pasa del 38 % de la ventana (en 375 px dejaba ver un solo día).
        const row = container.querySelector('[data-slot="timeline-row"]') as HTMLElement
        expect(row.style.gridTemplateColumns).toContain("min(15rem, 38vw)")
    })

    it("la barra es un enlace con el nombre completo, posicionada en días, con las dos marcas con borde blanco", () => {
        render(board())
        const bar = screen.getByRole("link", { name: /Kayla, 704 Casa Roma: check-in/ })
        expect(bar).toHaveAttribute("href", "/r/1")
        expect(bar).toHaveClass("bg-timeline-bar", "text-ink", "border-primary/30", "hover:bg-timeline-bar-strong", "focus-visible:outline-ring")
        // Del centro del día 1 (0.5 / 7 = 7.14 %) a dos días después (2 / 7 = 28.57 %), 4 px de aire a cada lado.
        expect(bar.style.left).toBe("calc(7.14286% + 4px)")
        expect(bar.style.width).toBe("calc(28.5714% - 8px)")
        const marks = bar.querySelectorAll('[data-slot="movement-mark"]')
        expect([...marks].map((m) => m.getAttribute("data-kind"))).toEqual(["checkin", "checkout"])
        for (const m of marks) expect(m).toHaveClass("border-2", "border-white")
        expect(bar).toHaveTextContent("Kayla · 2 noches")
    })

    it("sin el check-in o el checkout en la vista, ese extremo no lleva marca; una noche, solo las marcas chicas", () => {
        const { rerender } = render(board({ checkin: false }))
        const bar = () => screen.getByRole("link")
        const kinds = () => [...bar().querySelectorAll('[data-slot="movement-mark"]')].map((m) => m.getAttribute("data-kind"))
        expect(kinds()).toEqual(["checkout"])
        rerender(board({ checkout: false }))
        expect(kinds()).toEqual(["checkin"])
        rerender(board({ start: 1.5, end: 2.5 }))
        expect(bar()).toHaveAttribute("data-compact", "true")
        expect(bar()).not.toHaveTextContent("Kayla · 2 noches")
        for (const m of bar().querySelectorAll('[data-slot="movement-mark"]')) expect(m).toHaveClass("size-5")
    })

    it("el detalle se abre al enfocar la barra (sirve para las estadías cortas)", async () => {
        render(board())
        await act(async () => { fireEvent.focus(screen.getByRole("link")) })
        expect((await screen.findAllByText("2 noches")).length).toBeGreaterThan(0)
    })

    it("táctil: la barra es un botón; el primer toque abre el detalle con «Ver reserva» (no navega)", async () => {
        media.touch = true
        render(board({ start: 1.5, end: 2.5 }))
        expect(screen.queryByRole("link", { name: /Kayla/ })).toBeNull()
        const bar = screen.getByRole("button", { name: /^Kayla, 704 Casa Roma: check-in .*\. Ver detalle$/ })
        expect(bar).toHaveAttribute("data-touch", "true")
        expect(bar).toHaveAttribute("data-compact", "true")
        // Un <button> centra el texto por omisión: la barra lo alinea a la izquierda, como el enlace.
        expect(bar).toHaveClass("bg-timeline-bar", "text-left")
        await act(async () => { fireEvent.click(bar) })
        expect(await screen.findByText("Duración")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Ver reserva" })).toHaveAttribute("href", "/r/1")
    })

    it("con mouse no hay botón de detalle: la barra es el enlace", () => {
        render(board())
        expect(screen.queryByRole("button", { name: /Ver detalle/ })).toBeNull()
        expect(screen.getByRole("link", { name: /^Kayla/ })).not.toHaveAttribute("data-touch")
    })

    it("medio día (solo se ve un extremo): una sola marca chica, centrada, sin relleno — cabe en 22 px", () => {
        render(board({ start: 0, end: 0.5, checkin: false }))
        const bar = screen.getByRole("link")
        expect(bar).toHaveAttribute("data-tiny", "true")
        expect(bar).toHaveClass("justify-center", "px-0")
        expect(bar.style.width).toBe("calc(7.14286% - 8px)")
        const marks = bar.querySelectorAll('[data-slot="movement-mark"]')
        expect([...marks].map((m) => m.getAttribute("data-kind"))).toEqual(["checkout"])
        expect(marks[0]).toHaveClass("size-5")
    })

    it("entra y sale el mismo día (un día de ancho): las dos marcas chicas, sin texto, con relleno de 4 px", () => {
        render(board({ start: 2, end: 3 }))
        const bar = screen.getByRole("link")
        expect(bar).toHaveAttribute("data-compact", "true")
        expect(bar).not.toHaveAttribute("data-tiny")
        expect(bar).toHaveClass("px-1")
        expect([...bar.querySelectorAll('[data-slot="movement-mark"]')].map((m) => m.getAttribute("data-kind"))).toEqual(["checkin", "checkout"])
        expect(bar).not.toHaveTextContent("Kayla · 2 noches")
    })

    it("el modo táctil se consulta UNA vez por tablero, no una por barra", () => {
        render(
            <Timeline days={days} today={today} label="Ocupación" resourceLabel="3">
                <TimelineRow title="A">
                    {[0, 2, 4].map((at) => (
                        <TimelineBar key={at} start={at + 0.5} end={at + 1.5} href={`/r/${at}`} label={`b${at}`} detailTitle="x" details={[]}>x</TimelineBar>
                    ))}
                </TimelineRow>
            </Timeline>,
        )
        expect(screen.getAllByRole("link")).toHaveLength(3)
        expect(media.calls).toBe(1)
    })

    it("un segundo carril baja la barra y agranda la fila", () => {
        const { container } = render(
            <Timeline days={days} today={today} label="Ocupación" resourceLabel="1">
                <TimelineRow title="A" tracks={2}>
                    <TimelineBar start={0.5} end={3.5} track={1} href="/r/2" label="x" detailTitle="x" details={[]}>x</TimelineBar>
                </TimelineRow>
            </Timeline>,
        )
        expect(screen.getByRole("link").style.top).toBe("58px")
        const lane = container.querySelector('[data-slot="timeline-row"] > div:nth-child(2)') as HTMLElement
        expect(lane.style.minHeight).toBe("108px")
    })

    it("sin tone, la barra es la sólida de siempre y no lleva ícono de estado", () => {
        render(board())
        const bar = screen.getByRole("link")
        expect(bar).toHaveAttribute("data-tone", "default")
        expect(bar).toHaveClass("bg-timeline-bar", "text-ink")
        expect(bar.querySelector('[data-status-icon]')).toBeNull()
    })

    it.each([
        ["progress", ["bg-timeline-bar", "pattern-progress", "text-ink", "hover:bg-timeline-bar-strong"], "lucide-clock"],
        ["past", ["bg-success-sunk", "text-success", "border-success/30", "hover:border-success"], "lucide-check"],
        ["attention", ["border-2", "border-dashed", "border-primary", "bg-card", "text-ink", "hover:bg-table-head-soft"], "lucide-triangle-alert"],
        ["unknown", ["border-rule", "bg-sunk", "pattern-unknown", "text-ink-2", "hover:bg-rule"], "lucide-circle-question-mark"],
    ] as const)("tone=%s: el trazo, su hover y su ícono; nunca un relleno sólido de estado (compite con las marcas)", (tone, classes, icon) => {
        render(board({ tone }))
        const bar = screen.getByRole("link")
        expect(bar).toHaveAttribute("data-tone", tone)
        expect(bar).toHaveClass(...classes)
        expect(bar.className).not.toMatch(/\bbg-(success|warning|info|danger)(?![-\w])/)
        const mark = bar.querySelector('[data-status-icon]')
        expect(mark?.getAttribute("class")).toContain(icon)
        // Las marcas de entrada y salida no cambian con el estado.
        expect([...bar.querySelectorAll('[data-slot="movement-mark"]')].map((m) => m.getAttribute("data-kind"))).toEqual(["checkin", "checkout"])
    })

    it.each([
        ["progress", "text-primary-hover"],
        ["attention", "text-warning"],
        ["unknown", "text-ink-3"],
    ] as const)("tone=%s: el ícono lleva su color (%s), no el del texto", (tone, color) => {
        render(board({ tone }))
        expect(screen.getByRole("link").querySelector("[data-status-icon]")).toHaveClass(color)
    })

    it("compacta (una noche): sin ícono de estado, el trazo se mantiene", () => {
        render(board({ tone: "attention", start: 1.5, end: 2.5 }))
        const bar = screen.getByRole("link")
        expect(bar).toHaveClass("border-dashed")
        expect(bar.querySelector('[data-status-icon]')).toBeNull()
    })

    it("el estado va en el nombre accesible y en el detalle como StatusPill", async () => {
        render(board({ tone: "progress", status: { label: "En progreso", tone: "info" } }))
        const bar = screen.getByRole("link", { name: /2 noches\. En progreso$/ })
        await act(async () => { fireEvent.focus(bar) })
        const pills = await screen.findAllByText("En progreso")
        const pill = pills.map((el) => el.closest('[data-slot="status-pill"]')).find(Boolean)
        expect(pill).toHaveAttribute("data-tone", "info")
    })

    it("táctil: el estado también va en el nombre del botón y en el Popover", async () => {
        media.touch = true
        render(board({ status: { label: "Finalizada", tone: "idle" }, tone: "past" }))
        const button = screen.getByRole("button", { name: /2 noches\. Finalizada\. Ver detalle$/ })
        await act(async () => { fireEvent.click(button) })
        expect(await screen.findByText("Finalizada")).toBeInTheDocument()
    })

    it("TimelineLegend: las mismas marcas y la barra, con su palabra", () => {
        render(<TimelineLegend />)
        const legend = screen.getByRole("list", { name: "Leyenda" })
        expect(legend).toHaveTextContent("Check-inCheckoutEstadía")
        expect(legend.querySelectorAll('[data-slot="movement-mark"]')).toHaveLength(2)
    })

    it("TimelineLegend con tones: una muestra por estado, con la misma clase que la barra", () => {
        render(<TimelineLegend tones={[{ tone: "default", label: "Confirmada" }, { tone: "attention", label: "Abandonada o incompleta" }]} />)
        const legend = screen.getByRole("list", { name: "Leyenda" })
        expect(legend).toHaveTextContent("Check-inCheckoutConfirmadaAbandonada o incompleta")
        expect(legend).not.toHaveTextContent("Estadía")
        const swatches = legend.querySelectorAll('[data-slot="timeline-legend-swatch"]')
        expect([...swatches].map((s) => s.getAttribute("data-tone"))).toEqual(["default", "attention"])
        expect(swatches[1]).toHaveClass("border-dashed", "border-primary", "bg-card")
    })

    it("TimelineLegend sin barra (vista Mes): solo las dos marcas", () => {
        render(<TimelineLegend stay={false} />)
        expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("Check-inCheckout")
    })
})
