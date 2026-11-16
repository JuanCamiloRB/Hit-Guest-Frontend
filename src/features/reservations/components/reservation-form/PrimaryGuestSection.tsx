"use client"

import { useFormContext } from "react-hook-form"
import { Combobox } from "@/components/ui/combobox"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { CatalogError } from "@/components/shared/catalog-error"
import { FormSection } from "./FormSection"
import { RequiredMark } from "@/components/shared/required-mark"
import type { ReservationFormInput } from "./payload"
import type { CountryOption } from "./useReservationCatalogs"

interface PrimaryGuestSectionProps {
    countries: CountryOption[]
    loadingCountries: boolean
    countriesFailed: boolean
    onRetryCountries: () => void
}

export function PrimaryGuestSection({ countries, loadingCountries, countriesFailed, onRetryCountries }: PrimaryGuestSectionProps) {
    const form = useFormContext<ReservationFormInput>()

    return (
        <FormSection title="Huésped titular" description="Con esto se precarga su check-in.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="guestName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombres <RequiredMark /></FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: María" autoComplete="given-name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {/* Separado del nombre a propósito: así viaja partido a `extra` y el
                    check-in del titular puede precargarlo. Con un solo campo habría
                    que adivinar dónde acaba el nombre, y esto alimenta SIRE/TRA. */}
                <FormField
                    control={form.control}
                    name="guestLastname"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Apellidos <RequiredMark /></FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: González Pérez" autoComplete="family-name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="guestCountry"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nacionalidad <RequiredMark /></FormLabel>
                            <FormControl>
                                <Combobox
                                    ref={field.ref}
                                    value={field.value || null}
                                    onValueChange={(value) => field.onChange(value ?? "")}
                                    options={countries.map((c) => ({
                                        value: c.name,
                                        label: c.name,
                                        leading: c.extra?.emoji ? <span aria-hidden>{c.extra.emoji}</span> : undefined,
                                    }))}
                                    placeholder="Busca un país"
                                    searchPlaceholder="Buscar país…"
                                    emptyText="No hay países con ese nombre"
                                    loading={loadingCountries}
                                />
                            </FormControl>
                            {countriesFailed && (
                                <CatalogError
                                    what="los países"
                                    consequence="La nacionalidad es obligatoria."
                                    retrying={loadingCountries}
                                    onRetry={onRetryCountries}
                                />
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="emailGuest"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Correo del huésped <RequiredMark /></FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="huesped@correo.com" autoComplete="email" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="guestPhone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teléfono <span className="font-normal text-ink-3">· opcional</span></FormLabel>
                            <FormControl>
                                <PhoneInputField value={field.value} onChange={field.onChange} placeholder="300 123 4567" />
                            </FormControl>
                            <FormDescription>Queda en la ficha para contactarlo.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </FormSection>
    )
}
