"use client"

import { useFormContext } from "react-hook-form"
import { Badge } from "@/components/ui/badge"
import { FieldError, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { MoneyField } from "@/components/ui/money-field"
import { formatMoney } from "@/lib/money"
import { hasAmountSeparator, parseAmountText } from "@/lib/amount-text"
import { CatalogError } from "@/components/shared/catalog-error"
import { FormSection } from "./FormSection"
import { RequiredMark } from "@/components/shared/required-mark"
import { pricePerNight } from "./stay"
import type { ReservationFormInput } from "./payload"
import type { CurrencyOption } from "./useReservationCatalogs"

interface ReservationValueSectionProps {
    currencies: CurrencyOption[]
    loadingCurrencies: boolean
    currenciesFailed: boolean
    onRetryCurrencies: () => void
    nights: number
    /** El precio vino del alojamiento y el PM no lo ha tocado. */
    priceSuggested: boolean
    onPriceEdited: () => void
    onCurrencyEdited: () => void
}

function withCurrent(codes: string[], current: string): string[] {
    return current && !codes.includes(current) ? [current, ...codes] : codes
}

export function ReservationValueSection({
    currencies, loadingCurrencies, currenciesFailed, onRetryCurrencies, nights, priceSuggested, onPriceEdited, onCurrencyEdited,
}: ReservationValueSectionProps) {
    const form = useFormContext<ReservationFormInput>()
    const currency = form.watch("currency")
    const currencyError = form.formState.errors.currency?.message

    return (
        <FormSection title="Valor de la reserva" description="El total de la estancia.">
            <FormField
                control={form.control}
                name="totalPrice"
                render={({ field }) => {
                    const raw = String(field.value ?? "").trim()
                    const amount = parseAmountText(raw)
                    const isZero = amount === 0
                    // Con separadores («650.000», «1.234,56») se dice cómo se leyó: el
                    // mismo texto vale seiscientos cincuenta mil en Colombia y 650 en
                    // `Number()`; la ambigüedad se ve aquí, no en la reserva creada.
                    const interpreted = amount !== null && hasAmountSeparator(raw) ? formatMoney(amount, currency) : null
                    const perNight = pricePerNight(amount, nights)
                    return (
                        <FormItem className="sm:max-w-sm">
                            <FormLabel>Precio total <RequiredMark /></FormLabel>
                            <FormControl>
                                <MoneyField
                                    ref={field.ref}
                                    amount={String(field.value ?? "")}
                                    onAmountChange={(value) => { field.onChange(value); onPriceEdited() }}
                                    currency={currency}
                                    onCurrencyChange={(value) => { form.setValue("currency", value, { shouldDirty: true, shouldValidate: true }); onCurrencyEdited() }}
                                    // Sin catálogo, la moneda que ya tiene el formulario sigue disponible.
                                    // El código (COP, USD) y no el nombre largo del catálogo: el
                                    // selector va unido al monto y «COP - Colombian peso» se cortaba.
                                    // La del formulario se ofrece aunque el catálogo no la traiga
                                    // (o no cargue): si no, el selector mostraría «—» con un valor.
                                    currencies={withCurrent(currencies.map((c) => c.id), currency).map((code) => ({ value: code, label: code }))}
                                    loadingCurrencies={loadingCurrencies}
                                    placeholder="0"
                                />
                            </FormControl>
                            {(isZero || perNight != null || priceSuggested || interpreted) && (
                                <FormDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    {interpreted && <span data-slot="amount-interpreted" className="tabular-nums text-ink-2">Se registra como {interpreted}</span>}
                                    {isZero && <Badge tone="info">Sin costo</Badge>}
                                    {perNight != null && <span className="tabular-nums">{formatMoney(perNight, currency)} por noche</span>}
                                    {priceSuggested && <span>· Sugerido por el alojamiento</span>}
                                </FormDescription>
                            )}
                            {currenciesFailed && (
                                <CatalogError
                                    what="las monedas"
                                    consequence={currency ? `Se conserva ${currency}.` : undefined}
                                    retrying={loadingCurrencies}
                                    onRetry={onRetryCurrencies}
                                />
                            )}
                            <FormMessage />
                        </FormItem>
                    )
                }}
            />
            {/* La moneda es parte del control de precio; su error se muestra aquí. */}
            {currencyError && <FieldError>{currencyError}</FieldError>}
        </FormSection>
    )
}
