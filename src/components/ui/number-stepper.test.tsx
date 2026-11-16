import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { NumberStepper } from "./number-stepper"
import { Label } from "./label"

function Field({
    initial = 2,
    onChange,
    ...props
}: Partial<Omit<React.ComponentProps<typeof NumberStepper>, "value" | "onValueChange">> & {
    initial?: number
    onChange?: (value: number) => void
}) {
    const [value, setValue] = React.useState(initial)
    return (
        <>
            <Label htmlFor="guests">Huéspedes</Label>
            <NumberStepper
                id="guests"
                value={value}
                onValueChange={(next) => {
                    setValue(next)
                    onChange?.(next)
                }}
                {...props}
            />
        </>
    )
}

describe("NumberStepper", () => {
    it("la Label htmlFor nombra el input numérico; la caja tiene la apariencia de campo", () => {
        render(<Field />)
        const input = screen.getByRole("spinbutton", { name: "Huéspedes" })
        expect(input).toHaveValue("2")
        expect(input).toHaveAttribute("inputmode", "numeric")
        expect(input).toHaveClass("text-center", "tabular-nums", "font-semibold")
        const box = input.closest('[data-slot="number-stepper"]')
        expect(box).toHaveClass("border-input", "rounded-md", "h-10", "focus-within:border-ring", "focus-within:ring-[3px]")
    })

    it("− y + cambian de a step y se detienen en los límites (botones deshabilitados)", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field initial={1} min={1} max={3} onChange={onChange} />)
        const minus = screen.getByRole("button", { name: "Quitar uno" })
        const plus = screen.getByRole("button", { name: "Agregar uno" })
        expect(minus).toBeDisabled()
        await user.click(plus)
        await user.click(plus)
        expect(onChange).toHaveBeenLastCalledWith(3)
        expect(screen.getByRole("spinbutton", { name: "Huéspedes" })).toHaveValue("3")
        expect(plus).toBeDisabled()
        await user.click(minus)
        expect(onChange).toHaveBeenLastCalledWith(2)
    })

    it("escribir 7 y salir emite 7; 12 con max 10 queda en 10", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field initial={2} max={10} onChange={onChange} />)
        const input = screen.getByRole("spinbutton", { name: "Huéspedes" })
        await user.clear(input)
        await user.type(input, "7")
        expect(onChange).not.toHaveBeenCalled()
        await user.tab()
        expect(onChange).toHaveBeenLastCalledWith(7)
        expect(input).toHaveValue("7")
        await user.clear(input)
        await user.type(input, "12")
        await user.tab()
        expect(onChange).toHaveBeenLastCalledWith(10)
        expect(input).toHaveValue("10")
    })

    it("basura o vacío al salir vuelve a min", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field initial={4} min={1} onChange={onChange} />)
        const input = screen.getByRole("spinbutton", { name: "Huéspedes" })
        await user.clear(input)
        await user.type(input, "abc")
        await user.tab()
        expect(onChange).toHaveBeenLastCalledWith(1)
        expect(input).toHaveValue("1")
        await user.clear(input)
        await user.tab()
        expect(onChange).toHaveBeenLastCalledWith(1)
    })

    it("disabled deshabilita el input y ambos botones; la caja se marca", () => {
        render(<Field disabled />)
        const input = screen.getByRole("spinbutton", { name: "Huéspedes" })
        expect(input).toBeDisabled()
        expect(screen.getByRole("button", { name: "Quitar uno" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Agregar uno" })).toBeDisabled()
        expect(input.closest('[data-slot="number-stepper"]')).toHaveAttribute("data-disabled")
    })

    it("aria-invalid y aria-describedby (FormControl) llegan al input y la caja se marca data-invalid", () => {
        render(
            <>
                <Label htmlFor="guests">Huéspedes</Label>
                <NumberStepper id="guests" value={1} onValueChange={() => {}} aria-invalid aria-describedby="guests-error" />
                <p id="guests-error">Mínimo un huésped</p>
            </>
        )
        const input = screen.getByRole("spinbutton", { name: "Huéspedes" })
        expect(input).toHaveAttribute("aria-invalid", "true")
        expect(input).toHaveAccessibleDescription("Mínimo un huésped")
        expect(input.closest('[data-slot="number-stepper"]')).toHaveAttribute("data-invalid")
    })
})

describe("NumberStepper — spinbutton (auditoría 2026-11-16)", () => {
    it("anuncia valor y límites, y ↑/↓ cambian de a step sin salir del rango", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(<Field initial={2} min={1} max={3} onChange={onChange} />)
        const input = screen.getByRole("spinbutton", { name: "Huéspedes" })
        expect(input).toHaveAttribute("aria-valuenow", "2")
        expect(input).toHaveAttribute("aria-valuemin", "1")
        expect(input).toHaveAttribute("aria-valuemax", "3")
        await user.click(input)
        await user.keyboard("{ArrowUp}{ArrowUp}")
        expect(input).toHaveValue("3")
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
        expect(input).toHaveValue("1")
        expect(onChange).toHaveBeenLastCalledWith(1)
    })
})
