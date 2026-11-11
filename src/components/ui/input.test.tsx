import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { Input } from "./input"
import { Textarea } from "./textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./form"
import { PhoneInputField } from "./phone-input-field"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

const mocks = vi.hoisted(() => ({ getCountries: vi.fn() }))
vi.mock("@/features/auth/services/catalog-service", () => ({ catalogService: { getCountries: mocks.getCountries } }))

describe("Input y Textarea — estados", () => {
    it.each([["Input", Input], ["Textarea", Textarea]] as const)("%s: tinta, placeholder ink-3, hover solo si se puede escribir, foco de 3 px", (_n, Field) => {
        render(<Field aria-label="Campo" placeholder="Escribe" />)
        const field = screen.getByRole("textbox", { name: "Campo" })
        expect(field).toHaveClass("text-ink", "placeholder:text-ink-3", "focus-visible:ring-[3px]")
        // Hover con el `hover:` de Tailwind (solo con puntero) y sin foco: el borde de foco gana.
        expect(field).toHaveClass("[&:not([readonly],[aria-invalid=true],:focus):enabled]:hover:border-primary")
        expect(field.className).not.toMatch(/placeholder:text-muted-foreground|disabled:opacity-50/)
    })

    it("las clases propias de una pantalla conviven con los estados (no los anulan)", () => {
        render(<Input aria-label="Campo" className="bg-slate-50 border-slate-200 h-11" disabled />)
        const field = screen.getByRole("textbox", { name: "Campo" })
        expect(field).toHaveClass("bg-slate-50", "border-slate-200", "h-11")
        expect(field).toHaveClass("disabled:bg-sunk", "disabled:text-ink-3", "focus-visible:ring-[3px]")
        expect(field).not.toHaveClass("border-input")
    })

    it("deshabilitado: legible y sin poder escribir", async () => {
        const user = userEvent.setup()
        render(<Input aria-label="Campo" disabled defaultValue="Ada" />)
        const field = screen.getByRole("textbox", { name: "Campo" })
        expect(field).toHaveClass("disabled:bg-sunk", "disabled:text-ink-3", "disabled:cursor-not-allowed")
        await user.type(field, "x")
        expect(field).toHaveValue("Ada")
    })

    it("readonly: enfocable y seleccionable, no editable, con fondo sunk", async () => {
        const user = userEvent.setup()
        render(<Input aria-label="Código" readOnly defaultValue="ABC-123" />)
        const field = screen.getByRole("textbox", { name: "Código" })
        expect(field).toHaveClass("[&[readonly]]:bg-sunk")
        await user.click(field)
        expect(field).toHaveFocus()
        await user.type(field, "x")
        expect(field).toHaveValue("ABC-123")
    })
})

function PhoneForm({ invalid = false }: { invalid?: boolean }) {
    const form = useForm({ defaultValues: { phone: "" } })
    return (
        <Form {...form}>
            <form>
                <FormField
                    control={form.control}
                    name="phone"
                    rules={{ required: "El teléfono es obligatorio" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teléfono</FormLabel>
                            <FormControl>
                                <PhoneInputField value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {invalid && <button type="button" onClick={() => void form.trigger("phone")}>Validar</button>}
            </form>
        </Form>
    )
}

describe("PhoneInputField dentro de un formulario", () => {
    it("la etiqueta nombra el número, el prefijo tiene nombre y el teclado es numérico", async () => {
        mocks.getCountries.mockResolvedValue([{ id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } }])
        render(<PhoneForm />)
        const number = await screen.findByRole("textbox", { name: "Teléfono" })
        expect(number).toHaveAttribute("type", "tel")
        expect(number).toHaveAttribute("inputmode", "numeric")
        expect(screen.getByRole("combobox", { name: "Prefijo telefónico" })).toBeInTheDocument()
    })

    it("la máscara sigue aceptando solo dígitos, con el prefijo delante", async () => {
        mocks.getCountries.mockResolvedValue([{ id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } }])
        const user = userEvent.setup()
        render(<PhoneForm />)
        const number = await screen.findByRole("textbox", { name: "Teléfono" })
        await user.type(number, "30a0-1")
        expect(number).toHaveValue("3001")
    })

    it("con error: aria-invalid y el mensaje vinculado por aria-describedby", async () => {
        mocks.getCountries.mockResolvedValue([{ id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } }])
        const user = userEvent.setup()
        render(<PhoneForm invalid />)
        const number = await screen.findByRole("textbox", { name: "Teléfono" })
        await user.click(screen.getByRole("button", { name: "Validar" }))
        const message = await screen.findByText("El teléfono es obligatorio")
        await waitFor(() => expect(number).toHaveAttribute("aria-invalid", "true"))
        expect(number.getAttribute("aria-describedby")).toContain(message.id)
        expect(screen.getByRole("combobox", { name: "Prefijo telefónico" })).toHaveAttribute("aria-invalid", "true")
    })

    it("mientras carga los prefijos, lo anuncia", () => {
        mocks.getCountries.mockReturnValue(new Promise(() => {}))
        render(<PhoneInputField />)
        expect(screen.getByRole("status")).toHaveTextContent("Cargando prefijos…")
    })

    it("sin etiqueta externa, el número se nombra solo", async () => {
        mocks.getCountries.mockResolvedValue([{ id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } }])
        render(<PhoneInputField />)
        expect(await screen.findByRole("textbox", { name: "Número de teléfono" })).toBeInTheDocument()
    })

    it("cambiar el prefijo conserva los dígitos", async () => {
        mocks.getCountries.mockResolvedValue([
            { id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } },
            { id: 1, name: "México", extra: { phone_prefix: "52", emoji: "🇲🇽" } },
        ])
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<PhoneInputField value="+573001234567" onChange={onChange} />)
        await user.click(await screen.findByRole("combobox", { name: "Prefijo telefónico" }))
        await user.click(await screen.findByRole("option", { name: /\+52/ }))
        expect(onChange).toHaveBeenLastCalledWith("+523001234567")
    })

    it("deshabilitado: prefijo y número quedan deshabilitados", async () => {
        mocks.getCountries.mockResolvedValue([{ id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } }])
        render(<PhoneInputField disabled />)
        expect(await screen.findByRole("textbox", { name: "Número de teléfono" })).toBeDisabled()
        expect(screen.getByRole("combobox", { name: "Prefijo telefónico" })).toBeDisabled()
    })

    it("con descripción y sin error: el número la referencia y el prefijo no", async () => {
        mocks.getCountries.mockResolvedValue([{ id: 48, name: "Colombia", extra: { phone_prefix: "57", emoji: "🇨🇴" } }])
        render(<PhoneInputField id="tel" aria-describedby="tel-ayuda" />)
        expect(await screen.findByRole("textbox")).toHaveAttribute("aria-describedby", "tel-ayuda")
        expect(screen.getByRole("combobox", { name: "Prefijo telefónico" })).not.toHaveAttribute("aria-describedby")
    })
})

