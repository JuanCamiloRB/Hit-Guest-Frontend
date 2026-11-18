import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { createRef } from "react"

import { AddressAutocomplete } from "./AddressAutocomplete"

// Sin red: el valor vacío no busca, y si buscara, no hay nada que responder.
vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })))

describe("AddressAutocomplete — lo que FormControl le pasa llega al input", () => {
    it("ref, id y aria-* van al <input>: la etiqueta lo nombra y form.setFocus lo enfoca", () => {
        const ref = createRef<HTMLInputElement>()
        render(
            <>
                <label htmlFor="direccion">Dirección</label>
                <AddressAutocomplete ref={ref} id="direccion" aria-invalid aria-describedby="direccion-error" value="" onChange={() => {}} onSelect={() => {}} />
                <p id="direccion-error">Escribe la dirección</p>
            </>,
        )
        const input = screen.getByRole("textbox", { name: "Dirección" })
        expect(ref.current).toBe(input)
        expect(input).toHaveAttribute("aria-invalid", "true")
        expect(input).toHaveAccessibleDescription("Escribe la dirección")
        ref.current?.focus()
        expect(input).toHaveFocus()
    })
})
