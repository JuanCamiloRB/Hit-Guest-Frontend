"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

/**
 * Monto + moneda como un solo control (DS, 2026-11-16): «Precio total» de una
 * reserva, el valor declarado de un iCal.
 *
 * - Una sola caja con la apariencia de campo (borde input, hover habilitado y
 *   sin foco ni error, anillo con `focus-within`, inválido en danger,
 *   deshabilitado legible), 40 px de alto.
 * - Izquierda: el monto, alineado a la derecha con cifras tabulares. `id`,
 *   `aria-invalid` y `aria-describedby` (los pone `FormControl`) van en él: la
 *   `Label htmlFor` lo nombra. Solo deja pasar dígitos y UN separador decimal
 *   («,» se vuelve «.»); no agrupa miles: el formulario recibe la cadena cruda
 *   y la convierte.
 * - Derecha: la moneda, un `Select` sin borde propio pegado al monto, con nombre
 *   `currencyLabel` y ancho fijo. Mientras `loadingCurrencies`, queda
 *   deshabilitado y muestra «…».
 *
 * `className` solo lleva layout (ancho, márgenes).
 */
interface MoneyFieldProps {
    /** El `<input>` del valor: react-hook-form lo enfoca en el primer error. */
    ref?: React.Ref<HTMLInputElement>
    /** Lo pone `FormControl`; va en el input del monto para que la `Label` lo nombre. */
    id?: string
    amount: string
    onAmountChange: (value: string) => void
    currency: string
    onCurrencyChange: (value: string) => void
    currencies: { value: string; label: string }[]
    /** Nombre accesible del selector de moneda. */
    currencyLabel?: string
    placeholder?: string
    disabled?: boolean
    currencyDisabled?: boolean
    loadingCurrencies?: boolean
    "aria-invalid"?: React.AriaAttributes["aria-invalid"]
    "aria-describedby"?: string
    /** Layout (ancho, márgenes). */
    className?: string
}

/**
 * Dígitos, puntos y comas, tal como se escriben: «1a2,5» → «12,5»; «650.000»
 * queda «650.000». El campo NO decide qué separador es decimal: eso lo hace
 * `parseAmountText` (`lib/amount-text`) al leer el valor, y el formulario
 * muestra cómo lo leyó. Antes la coma pasaba a punto y «650.000» viajaba como
 * 650: seiscientos cincuenta mil escrito a la colombiana se cobraba por 650.
 */
function sanitizeAmount(raw: string): string {
    return raw.replace(/[^0-9.,]/g, "")
}

function MoneyField({
    ref,
    id,
    amount,
    onAmountChange,
    currency,
    onCurrencyChange,
    currencies,
    currencyLabel = "Moneda",
    placeholder = "0",
    disabled = false,
    currencyDisabled = false,
    loadingCurrencies = false,
    className,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: MoneyFieldProps) {
    const invalid = ariaInvalid === true || ariaInvalid === "true"

    return (
        <div
            data-slot="money-field"
            data-invalid={invalid || undefined}
            data-disabled={disabled || undefined}
            className={cn(
                "border-input flex h-10 w-full items-stretch overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow,border-color]",
                "[&:not([data-invalid],[data-disabled]):not(:focus-within)]:hover:border-primary",
                "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                "data-[invalid]:border-danger data-[invalid]:ring-danger/20 dark:data-[invalid]:ring-danger/40",
                "data-[disabled]:bg-sunk data-[disabled]:text-ink-3 data-[disabled]:shadow-none",
                className
            )}
        >
            <input
                ref={ref}
                id={id}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                onChange={(event) => onAmountChange(sanitizeAmount(event.target.value))}
                data-slot="money-field-amount"
                className="text-ink placeholder:text-ink-3 selection:bg-primary selection:text-primary-foreground h-full min-w-0 flex-1 bg-transparent px-3 text-right text-sm tabular-nums outline-none disabled:cursor-not-allowed disabled:text-ink-3"
            />
            <Select value={currency} onValueChange={onCurrencyChange} disabled={disabled || currencyDisabled || loadingCurrencies}>
                <SelectTrigger
                    aria-label={currencyLabel}
                    data-slot="money-field-currency"
                    // Sin borde ni anillo propios: el foco y el error los pinta la caja.
                    className="border-rule bg-sunk/50 h-full w-24 shrink-0 rounded-none border-0 border-l shadow-none focus-visible:border-rule focus-visible:ring-0 disabled:border-rule aria-invalid:border-rule"
                >
                    {loadingCurrencies ? (
                        <span data-slot="select-value" className="text-ink-3">…</span>
                    ) : (
                        <SelectValue placeholder="—" />
                    )}
                </SelectTrigger>
                <SelectContent>
                    {currencies.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

export { MoneyField, sanitizeAmount }
export type { MoneyFieldProps }
