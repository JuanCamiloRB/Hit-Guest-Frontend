import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

/**
 * El caso de editar una reserva: el formulario pasa de vacío al valor guardado
 * (value) cuando las opciones todavía no llegaron. Dentro de un <form>, Radix
 * respondía con onValueChange("") y el campo se vaciaba solo.
 */
function Field({ value, items, onChange }: { value: string; items: string[]; onChange: (v: string) => void }) {
    return (
        <form>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger aria-label="Opción"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                    {items.map((item) => <SelectItem key={item} value={item}>{item.toUpperCase()}</SelectItem>)}
                </SelectContent>
            </Select>
        </form>
    )
}

describe("Select — un valor que llega antes que su opción no se vacía solo", () => {
    it('dentro de un formulario: no se llama onValueChange("") y, al llegar la opción, se muestra', () => {
        const onChange = vi.fn()
        const { rerender } = render(<Field value="" items={[]} onChange={onChange} />)
        // Se rellena el formulario antes de que lleguen las opciones…
        rerender(<Field value="bravo" items={[]} onChange={onChange} />)
        // …y después llegan.
        rerender(<Field value="bravo" items={["alfa", "bravo"]} onChange={onChange} />)

        expect(onChange).not.toHaveBeenCalledWith("")
        expect(screen.getByRole("combobox", { name: "Opción" })).toHaveTextContent("BRAVO")
    })

    it("una elección real sigue llegando a onValueChange", async () => {
        const { default: userEvent } = await import("@testing-library/user-event")
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(<Field value="alfa" items={["alfa", "bravo"]} onChange={onChange} />)
        await user.click(screen.getByRole("combobox", { name: "Opción" }))
        await user.click(await screen.findByRole("option", { name: "BRAVO" }))
        expect(onChange).toHaveBeenCalledWith("bravo")
    })
})
