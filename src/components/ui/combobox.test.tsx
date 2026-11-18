import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { Combobox, type ComboboxOption } from "./combobox"
import { Label } from "./label"

// Radix Popover usa APIs de puntero y medición que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class {
    observe() {}
    unobserve() {}
    disconnect() {}
}

const COUNTRIES: ComboboxOption[] = [
    { value: "co", label: "Colombia", leading: "🇨🇴" },
    { value: "mx", label: "México", hint: "MX" },
    { value: "ar", label: "Argentina", disabled: true },
    { value: "pe", label: "Perú", keywords: "peru lima" },
]

function Field({
    initial = null,
    onChange,
    ...props
}: Partial<Omit<React.ComponentProps<typeof Combobox>, "value" | "onValueChange">> & {
    initial?: string | null
    onChange?: (value: string | null) => void
}) {
    const [value, setValue] = React.useState<string | null>(initial)
    return (
        <>
            <Label htmlFor="pais">País</Label>
            <Combobox
                id="pais"
                value={value}
                onValueChange={(next) => {
                    setValue(next)
                    onChange?.(next)
                }}
                options={COUNTRIES}
                placeholder="Selecciona un país"
                {...props}
            />
        </>
    )
}

describe("Combobox", () => {
    it("la Label htmlFor nombra el disparador; sin valor muestra el placeholder en ink-3 y el borde de campo", () => {
        render(<Field />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).toHaveTextContent("Selecciona un país")
        expect(trigger).toHaveAttribute("data-placeholder")
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        expect(trigger).toHaveClass("border-input", "data-[placeholder]:text-ink-3", "disabled:bg-sunk", "disabled:text-ink-3", "w-full")
    })

    it("un clic abre, enfoca el buscador y lista las opciones", async () => {
        const user = userEvent.setup()
        render(<Field />)
        await user.click(screen.getByRole("combobox", { name: "País" }))
        const options = await screen.findAllByRole("option")
        expect(options.map((option) => option.textContent)).toEqual(["🇨🇴Colombia", "MéxicoMX", "Argentina", "Perú"])
        expect(screen.getByRole("listbox")).toBeInTheDocument()
        expect(screen.getByPlaceholderText("Buscar…")).toHaveFocus()
        expect(screen.getByRole("combobox", { name: "País" })).toHaveAttribute("aria-expanded", "true")
    })

    it("filtra sin distinguir acentos ni mayúsculas, también por keywords y hint", async () => {
        const user = userEvent.setup()
        render(<Field />)
        await user.click(screen.getByRole("combobox", { name: "País" }))
        const search = await screen.findByPlaceholderText("Buscar…")
        await user.type(search, "mexico")
        expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["MéxicoMX"])
        await user.clear(search)
        await user.type(search, "LIMA")
        expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Perú"])
    })

    it("sin coincidencias muestra emptyText", async () => {
        const user = userEvent.setup()
        render(<Field emptyText="Ningún país coincide" />)
        await user.click(screen.getByRole("combobox", { name: "País" }))
        await user.type(await screen.findByPlaceholderText("Buscar…"), "zzz")
        expect(screen.queryAllByRole("option")).toHaveLength(0)
        expect(screen.getByText("Ningún país coincide")).toBeInTheDocument()
    })

    it("una opción deshabilitada se anuncia y un clic sobre ella no elige nada", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field onChange={onChange} />)
        await user.click(screen.getByRole("combobox", { name: "País" }))
        const argentina = await screen.findByRole("option", { name: "Argentina" })
        expect(argentina).toHaveAttribute("aria-disabled", "true")
        await user.click(argentina)
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.getByRole("listbox")).toBeInTheDocument()
    })

    it("un clic en una opción la elige, cierra y devuelve el foco al disparador", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field onChange={onChange} />)
        await user.click(screen.getByRole("combobox", { name: "País" }))
        await user.click(await screen.findByRole("option", { name: "Perú" }))
        expect(onChange).toHaveBeenCalledWith("pe")
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).toHaveTextContent("Perú")
        expect(trigger).not.toHaveAttribute("data-placeholder")
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
        expect(trigger).toHaveFocus()
    })

    it("teclado: Enter abre; las flechas saltan la deshabilitada; Enter elige y el foco vuelve al disparador", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field onChange={onChange} />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        trigger.focus()
        await user.keyboard("{Enter}")
        const search = await screen.findByPlaceholderText("Buscar…")
        expect(search).toHaveFocus()
        // Activa: la primera habilitada (Colombia). ↓ México, ↓ salta Argentina → Perú.
        await user.keyboard("{ArrowDown}{ArrowDown}")
        expect(search).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Perú" }).id)
        await user.keyboard("{Enter}")
        expect(onChange).toHaveBeenCalledWith("pe")
        expect(trigger).toHaveTextContent("Perú")
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
        expect(trigger).toHaveFocus()
    })

    it("Escape cierra sin elegir y enfoca el disparador", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Field onChange={onChange} />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        await user.click(trigger)
        await screen.findByRole("listbox")
        await user.keyboard("{Escape}")
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
        expect(onChange).not.toHaveBeenCalled()
        expect(trigger).toHaveFocus()
    })

    it("el valor elegido muestra su etiqueta (con leading) y marca la opción como seleccionada", async () => {
        const user = userEvent.setup()
        render(<Field initial="co" />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).toHaveTextContent("🇨🇴Colombia")
        await user.click(trigger)
        expect(await screen.findByRole("option", { name: /Colombia/ })).toHaveAttribute("aria-selected", "true")
        expect(screen.getByRole("option", { name: /México/ })).toHaveAttribute("aria-selected", "false")
    })

    it("loading: el disparador dice loadingText, sigue ENFOCABLE (no deshabilitado) y no abre", async () => {
        const user = userEvent.setup()
        render(<Field loading loadingText="Cargando países…" />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        // Deshabilitado no recibe foco, y el salto al primer campo inválido del
        // formulario de propiedad llegaba mientras el catálogo cargaba.
        expect(trigger).not.toBeDisabled()
        trigger.focus()
        expect(trigger).toHaveFocus()
        expect(trigger).toHaveTextContent("Cargando países…")
        expect(trigger).toHaveAttribute("aria-busy", "true")
        await user.click(trigger)
        await user.keyboard("{ArrowDown}")
        expect(screen.queryByRole("listbox")).toBeNull()
    })

    it("disabled: toBeDisabled y no se abre", async () => {
        const user = userEvent.setup()
        render(<Field disabled />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).toBeDisabled()
        await user.click(trigger)
        expect(screen.queryByRole("listbox")).toBeNull()
    })

    it("aria-invalid y aria-describedby (FormControl) llegan al disparador; la ref enfoca", () => {
        const ref = React.createRef<HTMLButtonElement>()
        render(
            <>
                <Label htmlFor="pais">País</Label>
                <Combobox
                    id="pais"
                    ref={ref}
                    value={null}
                    onValueChange={() => {}}
                    options={COUNTRIES}
                    aria-invalid
                    aria-describedby="pais-error"
                />
                <p id="pais-error">Elige un país</p>
            </>
        )
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).toHaveAttribute("aria-invalid", "true")
        expect(trigger).toHaveAccessibleDescription("Elige un país")
        expect(trigger).toHaveClass("aria-invalid:border-danger")
        ref.current?.focus()
        expect(trigger).toHaveFocus()
    })

    it("name: un input oculto lleva el valor para formularios planos", () => {
        const { container, rerender } = render(<Combobox name="country" value={null} onValueChange={() => {}} options={COUNTRIES} aria-label="País" />)
        const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="country"]')
        expect(hidden).toHaveValue("")
        rerender(<Combobox name="country" value="mx" onValueChange={() => {}} options={COUNTRIES} aria-label="País" />)
        expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="country"]')).toHaveValue("mx")
    })
})

describe("Combobox — ARIA y una sola fuente de apariencia (auditoría 2026-11-16)", () => {
    it("aria-controls solo apunta a la lista cuando existe, y la lista se llama como el campo", async () => {
        const user = userEvent.setup()
        render(<Field />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).not.toHaveAttribute("aria-controls")
        await user.click(trigger)
        const listbox = await screen.findByRole("listbox")
        expect(trigger).toHaveAttribute("aria-controls", listbox.id)
        expect(listbox).toHaveAttribute("aria-labelledby", "pais")
    })

    it("el disparador usa las clases de SelectTrigger (mismos estados), a todo el ancho", async () => {
        const { selectTriggerClasses } = await import("./select")
        render(<Field />)
        const trigger = screen.getByRole("combobox", { name: "País" })
        for (const token of ["border-input", "aria-invalid:border-danger", "disabled:bg-sunk", "focus-visible:border-ring", "w-full"]) {
            expect(trigger).toHaveClass(token)
        }
        expect(trigger).not.toHaveClass("w-fit")
        expect(selectTriggerClasses).toContain("[&:not([aria-invalid=true],:focus):enabled]:hover:border-primary")
    })
})
