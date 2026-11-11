import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FieldError, FieldHint } from "./form"
import { PasswordInput } from "./password-input"
import { TextLink } from "./text-link"

describe("FieldError", () => {
    it("sin contenido no pinta nada", () => {
        const { container } = render(<FieldError>{undefined}</FieldError>)
        expect(container).toBeEmptyDOMElement()
    })

    it("mismo estilo que FormMessage; compact para filas densas", () => {
        render(<><FieldError>Falta el correo</FieldError><FieldError compact>No se pudo cargar</FieldError></>)
        expect(screen.getByText("Falta el correo")).toHaveClass("text-danger", "text-sm")
        expect(screen.getByText("No se pudo cargar")).toHaveClass("text-danger", "text-xs")
    })
})

describe("FieldHint", () => {
    it("la ayuda pasa a error en el mismo nodo (mismo id para aria-describedby)", () => {
        const { rerender } = render(<FieldHint id="h" compact>Mínimo 10 USD</FieldHint>)
        expect(screen.getByText("Mínimo 10 USD")).toHaveClass("text-ink-3")
        rerender(<FieldHint id="h" compact invalid>Mínimo 10 USD</FieldHint>)
        const hint = screen.getByText("Mínimo 10 USD")
        expect(hint).toHaveClass("text-danger")
        expect(hint).toHaveAttribute("id", "h")
    })
})

describe("PasswordInput", () => {
    it("el botón tiene nombre, conmuta la visibilidad y lo anuncia con aria-pressed", async () => {
        render(<PasswordInput aria-label="Contraseña" defaultValue="secreto" />)
        const input = screen.getByLabelText("Contraseña")
        expect(input).toHaveAttribute("type", "password")
        const toggle = screen.getByRole("button", { name: "Mostrar contraseña" })
        expect(toggle).toHaveAttribute("aria-pressed", "false")
        await userEvent.click(toggle)
        expect(input).toHaveAttribute("type", "text")
        expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true")
    })
})

describe("TextLink", () => {
    it("se lee como dato (tinta) y se reconoce como enlace al pasar o enfocar", () => {
        render(<TextLink href="/dashboard/reservations/1">Ana Pérez</TextLink>)
        const link = screen.getByRole("link", { name: "Ana Pérez" })
        expect(link).toHaveClass("text-ink", "hover:text-primary", "hover:underline", "focus-visible:outline-2")
    })
})
