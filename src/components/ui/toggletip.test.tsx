import { describe, expect, it } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Users } from "lucide-react"

import { Toggletip, ToggletipLine, ToggletipNote, ToggletipTitle } from "./toggletip"

globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

function Demo() {
    return (
        <>
            <Toggletip
                content={(
                    <>
                        <ToggletipTitle>Contrato</ToggletipTitle>
                        <ToggletipLine tone="success">Contrato de alquiler · firmado</ToggletipLine>
                        <ToggletipLine tone="danger">Garantía · falló</ToggletipLine>
                        <ToggletipNote>Firma nativa de HitGuest</ToggletipNote>
                    </>
                )}
            >
                <button type="button">Contrato: firmado</button>
            </Toggletip>
            <button type="button">Fuera</button>
        </>
    )
}

const detail = () => screen.queryByText("Contrato de alquiler · firmado")
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

describe("Toggletip — detalle al pasar, enfocar o tocar", () => {
    it("mouse: abre al pasar (tras una espera corta) y cierra al salir", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        await user.hover(screen.getByRole("button", { name: "Contrato: firmado" }))
        await wait(200)
        expect(detail()).toBeInTheDocument()
        await user.unhover(screen.getByRole("button", { name: "Contrato: firmado" }))
        await wait(200)
        expect(detail()).toBeNull()
    })

    it("teclado: abre al enfocar con Tab, sin mover el foco; queda enlazado por aria-describedby; Escape cierra", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        await user.tab()
        const trigger = screen.getByRole("button", { name: "Contrato: firmado" })
        expect(trigger).toHaveFocus()
        expect(detail()).toBeInTheDocument()
        expect(trigger).toHaveAccessibleDescription(/Contrato de alquiler · firmado/)
        await user.keyboard("{Escape}")
        expect(detail()).toBeNull()
        expect(trigger).toHaveFocus()
    })

    it("toque/clic: abre y otro clic cierra; un clic fuera también cierra", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        const trigger = screen.getByRole("button", { name: "Contrato: firmado" })
        fireEvent.pointerDown(trigger, { pointerType: "touch" })
        fireEvent.click(trigger)
        expect(detail()).toBeInTheDocument()
        fireEvent.pointerDown(trigger, { pointerType: "touch" })
        fireEvent.click(trigger)
        expect(detail()).toBeNull()

        fireEvent.click(trigger)
        expect(detail()).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Fuera" }))
        expect(detail()).toBeNull()
    })

    it("un clic con el detalle abierto por hover lo FIJA: salir con el mouse ya no lo cierra", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        const trigger = screen.getByRole("button", { name: "Contrato: firmado" })
        await user.hover(trigger)
        await wait(200)
        await user.click(trigger)
        expect(detail()).toBeInTheDocument()
        await user.unhover(trigger)
        await wait(200)
        expect(detail()).toBeInTheDocument()
    })

    it("con el dedo, pasar por encima NO abre (solo el toque lo hace): en móvil no parpadea", async () => {
        render(<Demo />)
        fireEvent.pointerEnter(screen.getByRole("button", { name: "Contrato: firmado" }), { pointerType: "touch" })
        await wait(200)
        expect(detail()).toBeNull()
    })

    it("las líneas llevan la marca de forma del tono, no solo el color", () => {
        render(<Demo />)
        fireEvent.click(screen.getByRole("button", { name: "Contrato: firmado" }))
        const lines = document.querySelectorAll('[data-slot="toggletip-line"]')
        expect(lines[0].querySelector("svg")).toHaveClass("lucide-check", "text-success")
        expect(lines[1].querySelector("svg")).toHaveClass("lucide-x", "text-danger")
    })
})

describe("Toggletip — auditoría visual 2026-11-19", () => {
    function Two() {
        return (
            <div onClick={() => clicks.push("fila")}>
                <Toggletip label="Contrato" content={<ToggletipLine tone="success">Detalle A</ToggletipLine>}>
                    <button type="button">A</button>
                </Toggletip>
                <Toggletip label="Acceso" content={<ToggletipLine tone="warning">Detalle B</ToggletipLine>}>
                    <button type="button">B</button>
                </Toggletip>
            </div>
        )
    }
    const clicks: string[] = []

    it("abierto por hover NO captura el puntero (bajar por la columna sigue abriendo cada celda); fijado sí", async () => {
        const user = userEvent.setup()
        render(<Two />)
        await user.hover(screen.getByRole("button", { name: "A" }))
        await wait(200)
        const panel = document.querySelector('[data-slot="toggletip-content"]')!
        expect(panel).toHaveClass("pointer-events-none")
        fireEvent.click(screen.getByRole("button", { name: "A" }))
        expect(document.querySelector('[data-slot="toggletip-content"]')).not.toHaveClass("pointer-events-none")
    })

    it("uno a la vez: abrir otro cierra el que estaba fijado", () => {
        render(<Two />)
        fireEvent.click(screen.getByRole("button", { name: "A" }))
        expect(screen.getByText("Detalle A")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "B" }))
        expect(screen.getByText("Detalle B")).toBeInTheDocument()
        expect(screen.queryByText("Detalle A")).toBeNull()
    })

    it("al desplazar se cierra (no se queda encima de la columna fija)", () => {
        render(<Two />)
        fireEvent.click(screen.getByRole("button", { name: "A" }))
        expect(screen.getByText("Detalle A")).toBeInTheDocument()
        act(() => { document.body.dispatchEvent(new Event("scroll", { bubbles: false })) })
        expect(screen.queryByText("Detalle A")).toBeNull()
    })

    it("un clic DENTRO del detalle no llega a la fila (el portal no corta el burbujeo de React)", () => {
        clicks.length = 0
        render(<Two />)
        fireEvent.click(screen.getByRole("button", { name: "A" }))
        clicks.length = 0
        fireEvent.click(screen.getByText("Detalle A"))
        expect(clicks).toEqual([])
    })

    it("el panel tiene nombre accesible", () => {
        render(<Two />)
        fireEvent.click(screen.getByRole("button", { name: "A" }))
        expect(document.querySelector('[data-slot="toggletip-content"]')).toHaveAttribute("aria-label", "Contrato")
    })
})


describe("ToggletipLine — estado o dato", () => {
    it("con `tone`, la marca de forma del estado; con `icon`, el ícono del dato en tinta tenue y sin marca", () => {
        render(<>
            <ToggletipLine tone="success">Firmado</ToggletipLine>
            <ToggletipLine icon={Users}>Hasta 6 huéspedes</ToggletipLine>
        </>)
        const [state, data] = document.querySelectorAll('[data-slot="toggletip-line"]')
        expect(state).toHaveAttribute("data-tone", "success")
        expect(state.querySelector(".lucide-check")).not.toBeNull()
        expect(data).toHaveAttribute("data-tone", "neutral")
        expect(data.querySelector(".lucide-users")).toHaveClass("text-ink-3")
        expect(data.querySelector(".lucide-check, .lucide-clock, .lucide-x")).toBeNull()
        expect(data).toHaveTextContent("Hasta 6 huéspedes")
    })
})
