import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ReadOnlyField } from "./read-only-field"

describe("ReadOnlyField", () => {
    it("es un término y su definición, no un control: ningún textbox que prometa foco", () => {
        render(<ReadOnlyField label="Número de documento" value="1020304050" hint="No editable: identifica tu registro." />)
        expect(screen.queryByRole("textbox")).toBeNull()
        const term = screen.getByText("Número de documento")
        expect(term.tagName).toBe("DT")
        const value = screen.getByText("1020304050")
        // El valor va en la caja hundida, dentro del dd, al tamaño de un Input.
        const box = value.closest('[data-slot="surface"]')!
        expect(box).toHaveAttribute("data-tone", "sunk")
        expect(box).toHaveClass("text-base", "md:text-sm")
        expect(value).toHaveClass("break-words", "[overflow-wrap:anywhere]")
        expect(value).not.toHaveClass("truncate")
        expect(box.closest("dd")).not.toBeNull()
        expect(box.querySelector('[data-slot="icon"]')).toHaveAttribute("aria-hidden", "true")
        // La pista es una segunda definición del mismo término.
        expect(screen.getByText("No editable: identifica tu registro.").tagName).toBe("DD")
        const list = term.parentElement!
        expect(list.tagName).toBe("DL")
        expect([...list.children].map((c) => c.tagName)).toEqual(["DT", "DD", "DD"])
    })

    it("sin valor muestra «—»; sin candado cuando el dato solo se informa; sin pista, una sola definición", () => {
        render(<ReadOnlyField label="Correo de la cuenta" value="" locked={false} />)
        const term = screen.getByText("Correo de la cuenta")
        const list = term.parentElement!
        expect([...list.children].map((c) => c.tagName)).toEqual(["DT", "DD"])
        expect(screen.getByText("—")).toBeInTheDocument()
        expect(list.querySelector('[data-slot="icon"]')).toBeNull()
    })

    it("mantiene visible un correo largo en vez de recortarlo", () => {
        const email = "una-cuenta-con-un-nombre-muy-largo@propiedad-ejemplo.com"
        render(<ReadOnlyField label="Correo de la cuenta" value={email} locked={false} />)
        const value = screen.getByText(email)
        expect(value).toHaveTextContent(email)
        expect(value).toHaveClass("[overflow-wrap:anywhere]")
        expect(value).not.toHaveClass("truncate")
    })
})
