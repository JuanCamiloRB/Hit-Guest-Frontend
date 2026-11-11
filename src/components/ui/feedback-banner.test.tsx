import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { Button } from "./button"
import { FeedbackBanner } from "./feedback-banner"

const banner = (container: HTMLElement) => container.querySelector("[data-slot=feedback-banner]") as HTMLElement

describe("FeedbackBanner — tonos", () => {
    it.each([
        ["info", "bg-info-sunk", "text-info", "lucide-info"],
        ["success", "bg-success-sunk", "text-success", "lucide-circle-check"],
        ["warning", "bg-warning-sunk", "text-warning", "lucide-triangle-alert"],
        ["danger", "bg-danger-sunk", "text-danger", "lucide-circle-alert"],
    ] as const)("%s: fondo y tinta de sus tokens, con su ícono", (tone, bg, ink, icon) => {
        const { container } = render(<FeedbackBanner tone={tone} title="Título">Detalle</FeedbackBanner>)
        expect(banner(container)).toHaveClass(bg)
        expect(banner(container)).toHaveAttribute("data-tone", tone)
        expect(screen.getByText("Título")).toHaveClass(ink, "font-semibold")
        expect(screen.getByText("Detalle")).toHaveClass("text-ink-2")
        const svg = banner(container).querySelector("svg")!
        expect(svg).toHaveClass(icon, ink)
        expect(svg).toHaveAttribute("aria-hidden", "true")
    })

    it("no usa colores de paleta sueltos: solo tokens", () => {
        for (const tone of ["info", "success", "warning", "danger"] as const) {
            const { container, unmount } = render(<FeedbackBanner tone={tone} title="t" action={<span>a</span>}>d</FeedbackBanner>)
            const classes = [...container.querySelectorAll("*")].flatMap((el) => [...el.classList])
            expect(classes.filter((c) => /-(amber|red|rose|green|emerald|blue|sky|yellow|slate|gray)-\d/.test(c))).toEqual([])
            unmount()
        }
    })
})

describe("FeedbackBanner — rol según cómo aparece", () => {
    it("fijo (por defecto): sin rol, no se anuncia", () => {
        const { container } = render(<FeedbackBanner tone="warning">Esta propiedad no tiene PMS.</FeedbackBanner>)
        expect(banner(container)).not.toHaveAttribute("role")
        expect(banner(container)).toHaveAttribute("data-mode", "static")
        expect(screen.queryByRole("status")).toBeNull()
        expect(screen.queryByRole("alert")).toBeNull()
    })

    it("dinámico: status, se anuncia sin interrumpir", () => {
        render(<FeedbackBanner tone="success" mode="dynamic">Guardado.</FeedbackBanner>)
        expect(screen.getByRole("status")).toHaveTextContent("Guardado.")
        expect(screen.queryByRole("alert")).toBeNull()
    })

    it("error bloqueante: alert", () => {
        render(<FeedbackBanner tone="danger" mode="blocking" title="No se pudo cargar">Revisa tu conexión.</FeedbackBanner>)
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargarRevisa tu conexión.")
    })

    it("los tipos no aceptan `role`, y `blocking` solo existe para errores", () => {
        // Solo comprobación de tipos: `tsc` falla si alguno deja de ser un error.
        // `aria-live`, `aria-busy` y demás no se pueden probar así: en JSX,
        // TypeScript no revisa los atributos con guion que no están declarados.
        // Para ellos la garantía es la de abajo (se fijan después del spread).
        const typeChecks = () => (
            <>
                {/* @ts-expect-error — el rol lo decide `mode` */}
                <FeedbackBanner tone="info" role="alert">x</FeedbackBanner>
                {/* @ts-expect-error — una advertencia que interrumpe es ruido */}
                <FeedbackBanner tone="warning" mode="blocking">y</FeedbackBanner>
            </>
        )
        expect(typeChecks).toBeTypeOf("function")
    })

    it("un atributo de anuncio escrito directamente en JSX tampoco cambia nada", () => {
        const { container } = render(
            <FeedbackBanner tone="success" mode="dynamic" aria-live="assertive" aria-busy="true" aria-atomic="false">
                Guardado.
            </FeedbackBanner>,
        )
        expect(banner(container)).toHaveAttribute("role", "status")
        expect(banner(container)).toHaveAttribute("aria-live", "polite")
        expect(banner(container)).toHaveAttribute("aria-atomic", "true")
        expect(banner(container)).not.toHaveAttribute("aria-busy")
    })

    // Un objeto propagado esquiva los tipos (`{...rest}` de un `any`, props de
    // otro componente): el DOM tiene que salir igual.
    const injected = {
        role: "alert",
        "aria-live": "assertive",
        "aria-atomic": "false",
        "aria-relevant": "all",
        "aria-busy": "true",
        "data-mode": "blocking",
        "data-tone": "danger",
        "data-slot": "otro",
    } as unknown as Record<string, never>

    it.each([
        ["static", "info", { role: null, "aria-live": null, "aria-atomic": null }],
        ["dynamic", "success", { role: "status", "aria-live": "polite", "aria-atomic": "true" }],
        ["blocking", "danger", { role: "alert", "aria-live": "assertive", "aria-atomic": "true" }],
    ] as const)("%s: un objeto propagado no altera la semántica calculada por `mode`", (mode, tone, expected) => {
        const { container } = render(
            <FeedbackBanner {...injected} {...({ tone, mode } as { tone: "danger"; mode: "blocking" })}>
                Aviso
            </FeedbackBanner>,
        )
        const el = banner(container)
        expect(el).not.toBeNull()
        for (const [attr, value] of Object.entries(expected)) {
            if (value === null) expect(el).not.toHaveAttribute(attr)
            else expect(el).toHaveAttribute(attr, value)
        }
        expect(el).not.toHaveAttribute("aria-relevant")
        expect(el).not.toHaveAttribute("aria-busy")
        expect(el).toHaveAttribute("data-mode", mode)
        expect(el).toHaveAttribute("data-tone", tone)
    })
})

describe("FeedbackBanner — densidad", () => {
    it.each([
        ["default", "text-sm", "size-4", "pl-6"],
        ["compact", "text-xs", "size-3.5", "pl-5"],
    ] as const)("%s: texto, ícono y acción alineada con el texto", (density, text, icon, indent) => {
        const { container } = render(
            <FeedbackBanner tone="warning" density={density} action={<Button size="sm">Registrar</Button>}>
                d
            </FeedbackBanner>,
        )
        expect(banner(container)).toHaveClass(text)
        expect(banner(container)).toHaveAttribute("data-density", density)
        expect(banner(container).querySelector("svg")).toHaveClass(icon)
        expect(container.querySelector("[data-slot=feedback-banner-action]")).toHaveClass(indent, "sm:pl-0")
    })

    it("la densidad no cambia cómo se anuncia", () => {
        render(<FeedbackBanner tone="danger" mode="blocking" density="compact">Falló</FeedbackBanner>)
        expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive")
    })
})

describe("FeedbackBanner — contenido", () => {
    it("el título es opcional y no es un encabezado (no ensucia el índice de la página)", () => {
        const { container } = render(<FeedbackBanner tone="info">Solo detalle</FeedbackBanner>)
        expect(container.querySelector("[data-slot=feedback-banner-title]")).toBeNull()
        render(<FeedbackBanner tone="info" title="Con título">d</FeedbackBanner>)
        expect(screen.queryByRole("heading")).toBeNull()
    })

    it("sin acción no deja un contenedor vacío; con acción, es operable y queda dentro del aviso", () => {
        const { container, rerender } = render(<FeedbackBanner tone="danger" mode="blocking">Falló</FeedbackBanner>)
        expect(container.querySelector("[data-slot=feedback-banner-action]")).toBeNull()

        const retry = vi.fn()
        rerender(
            <FeedbackBanner tone="danger" mode="blocking" action={<Button size="sm" onClick={retry}>Reintentar</Button>}>
                Falló
            </FeedbackBanner>,
        )
        const button = screen.getByRole("button", { name: "Reintentar" })
        expect(screen.getByRole("alert")).toContainElement(button)
        fireEvent.click(button)
        expect(retry).toHaveBeenCalledTimes(1)
    })

    it("acepta className y atributos del div", () => {
        const { container } = render(<FeedbackBanner tone="info" className="mt-4" id="aviso" data-testid="x">d</FeedbackBanner>)
        expect(banner(container)).toHaveClass("mt-4", "rounded-lg")
        expect(banner(container)).toHaveAttribute("id", "aviso")
    })
})

describe("FeedbackBanner — ícono propio y layout bar (DS-7c)", () => {
    it("un ícono con significado reemplaza al del tono, con la tinta del tono", async () => {
        const { Camera } = await import("lucide-react")
        const { container } = render(<FeedbackBanner tone="warning" icon={Camera}>Limpia el lente</FeedbackBanner>)
        const svg = container.querySelector("svg")
        expect(svg?.getAttribute("class")).toMatch(/lucide-camera/)
        expect(svg).toHaveClass("text-warning")
    })

    it("bar va a todo el ancho, sin radio; inline lleva radio lg", () => {
        const { container } = render(<><FeedbackBanner tone="danger" layout="bar">a</FeedbackBanner><FeedbackBanner tone="info">b</FeedbackBanner></>)
        const [bar, inline] = container.querySelectorAll('[data-slot="feedback-banner"]')
        expect(bar).toHaveAttribute("data-layout", "bar")
        expect(bar).not.toHaveClass("rounded-lg")
        expect(inline).toHaveClass("rounded-lg")
    })
})
