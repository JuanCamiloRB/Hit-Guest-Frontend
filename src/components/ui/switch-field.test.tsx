import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SwitchField } from "./switch-field"

describe("SwitchField", () => {
    it("el título es el nombre del interruptor y un clic en el texto lo cambia una sola vez", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<SwitchField label="Credenciales por alojamiento" checked={false} onCheckedChange={onChange} />)
        const control = screen.getByRole("switch", { name: "Credenciales por alojamiento" })
        expect(control).toHaveAttribute("aria-checked", "false")
        await user.click(screen.getByText("Credenciales por alojamiento"))
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it("sin descripción ni error no describe nada; el interruptor no recibe clases propias", () => {
        render(<SwitchField label="Activa" checked onCheckedChange={() => {}} />)
        const control = screen.getByRole("switch", { name: "Activa" })
        expect(control).not.toHaveAttribute("aria-describedby")
        expect(control).not.toHaveAttribute("aria-invalid")
        // La apariencia es de Switch: encendido primary, apagado ink-3.
        expect(control).toHaveClass("data-[state=checked]:bg-primary", "data-[state=unchecked]:bg-ink-3")
    })

    it("la descripción y el error quedan unidos al interruptor, y con error es inválido", () => {
        const { rerender } = render(
            <SwitchField id="scope" label="Por alojamiento" description="Cada alojamiento lleva sus credenciales." checked onCheckedChange={() => {}} />,
        )
        const control = screen.getByRole("switch", { name: "Por alojamiento" })
        expect(control).toHaveAttribute("aria-describedby", "scope-description")
        expect(control).toHaveAccessibleDescription("Cada alojamiento lleva sus credenciales.")
        expect(control).not.toHaveAttribute("aria-invalid")

        rerender(
            <SwitchField
                id="scope"
                label="Por alojamiento"
                description="Cada alojamiento lleva sus credenciales."
                error="Solo TRA y SIRE admiten credenciales por alojamiento."
                checked
                onCheckedChange={() => {}}
            />,
        )
        expect(control).toHaveAttribute("aria-describedby", "scope-description scope-error")
        expect(control).toHaveAttribute("aria-invalid", "true")
        expect(control).toHaveAccessibleDescription(
            "Cada alojamiento lleva sus credenciales. Solo TRA y SIRE admiten credenciales por alojamiento.",
        )
    })

    it("un error vacío no pinta nada ni invalida", () => {
        render(<SwitchField label="Activa" error={null} checked onCheckedChange={() => {}} />)
        const control = screen.getByRole("switch", { name: "Activa" })
        expect(control).not.toHaveAttribute("aria-invalid")
        expect(document.querySelector('[data-slot="field-error"]')).toBeNull()
    })

    it("deshabilitada no cambia y la fila lo marca", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<SwitchField label="Alojamiento activo" disabled checked={false} onCheckedChange={onChange} />)
        const control = screen.getByRole("switch", { name: "Alojamiento activo" })
        expect(control).toBeDisabled()
        expect(control.closest('[data-slot="switch-field"]')).toHaveAttribute("data-disabled", "true")
        await user.click(screen.getByText("Alojamiento activo"))
        expect(onChange).not.toHaveBeenCalled()
    })

    it("la fila compacta usa el interruptor chico y texto xs; la fila con caja se tiñe por tono", () => {
        render(
            <>
                <SwitchField variant="plain" size="sm" label="Heredar de la propiedad" checked onCheckedChange={() => {}} />
                <SwitchField tone="danger" label="Desactivada" description="Se omite." checked={false} onCheckedChange={() => {}} />
            </>,
        )
        const small = screen.getByRole("switch", { name: "Heredar de la propiedad" })
        expect(small).toHaveAttribute("data-size", "sm")
        const smallRow = small.closest('[data-slot="switch-field"]')
        expect(smallRow).toHaveAttribute("data-variant", "plain")
        expect(smallRow).not.toHaveClass("border", "p-3")

        const dangerRow = screen.getByRole("switch", { name: "Desactivada" }).closest('[data-slot="switch-field"]')
        expect(dangerRow).toHaveAttribute("data-tone", "danger")
        expect(dangerRow).toHaveClass("border-danger/30", "bg-danger-sunk/30")
        // El tono es estado de la fila, no un error: la explicación sigue en ink-3.
        expect(screen.getByText("Se omite.")).toHaveClass("text-ink-3")
        expect(screen.getByText("Se omite.")).not.toHaveClass("text-danger")
        expect(screen.getByText("Se omite.")).not.toHaveAttribute("data-invalid")
    })

    it("tono warning: fila teñida, explicación en ink-3, interruptor sin aria-invalid", () => {
        render(<SwitchField tone="warning" label="Alojamiento activo" description="La propiedad está inactiva." checked={false} onCheckedChange={() => {}} />)
        const control = screen.getByRole("switch", { name: "Alojamiento activo" })
        expect(control.closest('[data-slot="switch-field"]')).toHaveClass("border-warning/30", "bg-warning-sunk/30")
        expect(screen.getByText("La propiedad está inactiva.")).toHaveClass("text-ink-3")
        expect(control).not.toHaveAttribute("aria-invalid")
    })

    it("solo error, sin descripción: describe únicamente el error", () => {
        render(<SwitchField id="only" label="Por alojamiento" error="No admitido." checked onCheckedChange={() => {}} />)
        const control = screen.getByRole("switch", { name: "Por alojamiento" })
        expect(control).toHaveAttribute("aria-describedby", "only-error")
        expect(control).toHaveAccessibleDescription("No admitido.")
        expect(control).toHaveAttribute("aria-invalid", "true")
    })

    it("un ícono decorativo en el título no entra en el nombre", () => {
        render(
            <SwitchField
                variant="plain"
                label={<><svg aria-hidden="true" data-testid="glyph" />Enviar link de check-in ahora</>}
                checked
                onCheckedChange={() => {}}
            />,
        )
        expect(screen.getByRole("switch", { name: "Enviar link de check-in ahora" })).toBeInTheDocument()
    })
})
