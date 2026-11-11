import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { FileInput } from "./file-input"
import { Label } from "./label"
import { Radio } from "./radio"
import { UnstyledButton } from "./unstyled-button"

describe("UnstyledButton", () => {
    it("es type=button por defecto (no envía el formulario) y lleva el foco sólido del sistema", () => {
        const submit = vi.fn((e: React.FormEvent) => e.preventDefault())
        render(<form onSubmit={submit}><UnstyledButton className="rounded-xl p-4">Tarjeta</UnstyledButton></form>)
        const button = screen.getByRole("button", { name: "Tarjeta" })
        expect(button).toHaveAttribute("type", "button")
        expect(button).toHaveClass("focus-visible:outline-solid", "focus-visible:outline-ring", "rounded-xl", "p-4")
        fireEvent.click(button)
        expect(submit).not.toHaveBeenCalled()
    })

    it("respeta un type explícito", () => {
        render(<UnstyledButton type="submit">Enviar</UnstyledButton>)
        expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute("type", "submit")
    })
})

describe("Label", () => {
    it("default trae la tipografía del campo; plain solo la semántica", () => {
        render(<><Label htmlFor="a">Nombre</Label><Label variant="plain" htmlFor="b" className="text-xs">Acepto los términos</Label><input id="a" /><input id="b" /></>)
        expect(screen.getByText("Nombre")).toHaveClass("text-sm", "font-medium", "leading-none")
        const plain = screen.getByText("Acepto los términos")
        expect(plain).not.toHaveClass("leading-none", "flex", "font-medium")
        expect(plain).toHaveClass("text-xs", "peer-disabled:cursor-not-allowed")
        expect(screen.getByLabelText("Acepto los términos")).toHaveAttribute("id", "b")
    })
})

describe("FileInput y Radio", () => {
    it("FileInput es un input de archivo oculto que conserva su nombre accesible", () => {
        render(<FileInput aria-label="Subir logo" accept="image/png" />)
        const input = screen.getByLabelText("Subir logo")
        expect(input).toHaveAttribute("type", "file")
        expect(input).toHaveClass("sr-only")
    })

    it("Radio es nativo (grupo por name) con el color de interacción", () => {
        render(<><Radio name="g" aria-label="Uno" defaultChecked /><Radio name="g" aria-label="Dos" /></>)
        const [one, two] = screen.getAllByRole("radio")
        expect(one).toBeChecked()
        expect(two).toHaveClass("accent-primary", "focus-visible:outline-ring")
        fireEvent.click(two)
        expect(two).toBeChecked()
        expect(one).not.toBeChecked()
    })
})
