import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { MoneyField, sanitizeAmount } from "./money-field"
import { Label } from "./label"

// Radix Select usa APIs de puntero que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

const CURRENCIES = [
    { value: "USD", label: "USD" },
    { value: "COP", label: "COP" },
    { value: "MXN", label: "MXN" },
]

function Field({
    initialAmount = "",
    initialCurrency = "USD",
    onAmount,
    onCurrency,
    ...props
}: Partial<Omit<React.ComponentProps<typeof MoneyField>, "amount" | "onAmountChange" | "currency" | "onCurrencyChange" | "currencies">> & {
    initialAmount?: string
    initialCurrency?: string
    onAmount?: (value: string) => void
    onCurrency?: (value: string) => void
}) {
    const [amount, setAmount] = React.useState(initialAmount)
    const [currency, setCurrency] = React.useState(initialCurrency)
    return (
        <>
            <Label htmlFor="price">Precio total</Label>
            <MoneyField
                id="price"
                amount={amount}
                onAmountChange={(next) => {
                    setAmount(next)
                    onAmount?.(next)
                }}
                currency={currency}
                onCurrencyChange={(next) => {
                    setCurrency(next)
                    onCurrency?.(next)
                }}
                currencies={CURRENCIES}
                {...props}
            />
        </>
    )
}

describe("sanitizeAmount", () => {
    it("deja dígitos, puntos y comas tal como se escriben; el campo no decide el separador decimal", () => {
        expect(sanitizeAmount("1a2,5")).toBe("12,5")
        expect(sanitizeAmount("1.2.3")).toBe("1.2.3")
        expect(sanitizeAmount("1,234,56")).toBe("1,234,56")
        // «650.000» escrito a la colombiana se conserva: lo lee `parseAmountText` como 650000.
        expect(sanitizeAmount("650.000")).toBe("650.000")
        expect(sanitizeAmount("$ 1500")).toBe("1500")
        expect(sanitizeAmount("")).toBe("")
        expect(sanitizeAmount(",")).toBe(",")
    })
})

describe("MoneyField", () => {
    it("la Label htmlFor nombra el input del monto; la caja tiene la apariencia de campo", () => {
        render(<Field />)
        const input = screen.getByRole("textbox", { name: "Precio total" })
        expect(input).toHaveAttribute("inputmode", "decimal")
        expect(input).toHaveAttribute("placeholder", "0")
        expect(input).toHaveClass("text-right", "tabular-nums")
        const box = input.closest('[data-slot="money-field"]')
        expect(box).toHaveClass("border-input", "rounded-md", "h-10", "focus-within:border-ring", "focus-within:ring-[3px]")
    })

    it("escribir «1a2,5» emite «12,5» (la letra se descarta, la coma se conserva)", async () => {
        const onAmount = vi.fn()
        const user = userEvent.setup()
        render(<Field onAmount={onAmount} />)
        const input = screen.getByRole("textbox", { name: "Precio total" })
        await user.type(input, "1a2,5")
        expect(input).toHaveValue("12,5")
        expect(onAmount).toHaveBeenLastCalledWith("12,5")
    })

    it("la moneda es un Select con nombre que lista las monedas y emite al cambiar", async () => {
        const onCurrency = vi.fn()
        const user = userEvent.setup()
        render(<Field onCurrency={onCurrency} />)
        const currency = screen.getByRole("combobox", { name: "Moneda" })
        expect(currency).toHaveTextContent("USD")
        expect(currency).toHaveClass("w-24", "rounded-none", "border-l", "border-rule")
        await user.click(currency)
        const options = await screen.findAllByRole("option")
        expect(options.map((option) => option.textContent)).toEqual(["USD", "COP", "MXN"])
        await user.click(screen.getByRole("option", { name: "COP" }))
        expect(onCurrency).toHaveBeenCalledWith("COP")
        expect(screen.getByRole("combobox", { name: "Moneda" })).toHaveTextContent("COP")
    })

    it("loadingCurrencies: el selector queda deshabilitado y muestra «…»", () => {
        render(<Field loadingCurrencies />)
        const currency = screen.getByRole("combobox", { name: "Moneda" })
        expect(currency).toBeDisabled()
        expect(currency).toHaveTextContent("…")
        expect(screen.getByRole("textbox", { name: "Precio total" })).toBeEnabled()
    })

    it("aria-invalid y aria-describedby (FormControl) llegan al input y la caja se marca data-invalid", () => {
        render(
            <>
                <Label htmlFor="price">Precio total</Label>
                <MoneyField
                    id="price"
                    amount=""
                    onAmountChange={() => {}}
                    currency="USD"
                    onCurrencyChange={() => {}}
                    currencies={CURRENCIES}
                    aria-invalid
                    aria-describedby="price-error"
                />
                <p id="price-error">Indica el precio</p>
            </>
        )
        const input = screen.getByRole("textbox", { name: "Precio total" })
        expect(input).toHaveAttribute("aria-invalid", "true")
        expect(input).toHaveAccessibleDescription("Indica el precio")
        const box = input.closest('[data-slot="money-field"]')
        expect(box).toHaveAttribute("data-invalid")
        expect(box).toHaveClass("data-[invalid]:border-danger")
    })

    it("disabled deshabilita el monto y la moneda; currencyDisabled solo la moneda", () => {
        const { rerender } = render(<Field disabled />)
        expect(screen.getByRole("textbox", { name: "Precio total" })).toBeDisabled()
        expect(screen.getByRole("combobox", { name: "Moneda" })).toBeDisabled()
        expect(screen.getByRole("textbox", { name: "Precio total" }).closest('[data-slot="money-field"]')).toHaveAttribute("data-disabled")
        rerender(<Field currencyDisabled />)
        expect(screen.getByRole("textbox", { name: "Precio total" })).toBeEnabled()
        expect(screen.getByRole("combobox", { name: "Moneda" })).toBeDisabled()
    })
})
