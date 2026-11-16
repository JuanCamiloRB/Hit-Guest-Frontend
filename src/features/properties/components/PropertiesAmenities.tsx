"use client"

import { useFormContext } from "react-hook-form"
import { FormField, FormItem, FormMessage } from "@/components/ui/form"
import { SectionCard } from "@/components/ui/section-card"
import { CheckboxCard } from "@/components/ui/checkbox-card"
import { CatalogError } from "@/components/shared/catalog-error"
import { useCallback, useEffect, useState } from "react"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * Las amenidades de la propiedad: una grilla de `CheckboxCard` sobre el campo
 * `amenities` (ids como string, el shape que ya viajaba). Sin ícono en el
 * título ni tarjeta hecha a mano: la selección la pinta la primitiva.
 */
export function PropertiesAmenities() {
    const form = useFormContext()
    const [amenities, setAmenities] = useState<CatalogOption[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [failed, setFailed] = useState(false)

    // Cadena `.then()`: `react-hooks/set-state-in-effect` solo acepta setState en callbacks.
    const fetchAmenities = useCallback(() =>
        catalogService.getAmenities()
            .then((data) => { setAmenities(data); setFailed(false) })
            .catch((error) => {
                console.error("Error fetching amenities:", error)
                setFailed(true)
            })
            .finally(() => setIsLoading(false)), [])

    useEffect(() => { void fetchAmenities() }, [fetchAmenities])

    const retry = () => {
        setIsLoading(true)
        void fetchAmenities()
    }

    return (
        <SectionCard
            title="Amenidades"
            description="Lo que incluye la propiedad. Cada alojamiento las hereda, salvo que defina las suyas."
            headingLevel={2}
        >
            {isLoading && !failed ? (
                <LoadingState rows={3} label="Cargando amenidades…" />
            ) : failed ? (
                <CatalogError what="las amenidades" consequence="Puedes guardar sin ellas y agregarlas después." retrying={isLoading} onRetry={retry} />
            ) : amenities.length === 0 ? (
                <EmptyState title="El catálogo de amenidades está vacío." />
            ) : (
                <FormField
                    control={form.control}
                    name="amenities"
                    render={({ field }) => {
                        const selected: string[] = field.value || []
                        return (
                            <FormItem>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {amenities.map((item) => {
                                        const id = String(item.id)
                                        return (
                                            <CheckboxCard
                                                key={id}
                                                label={item.name}
                                                checked={selected.includes(id)}
                                                onCheckedChange={(checked) => {
                                                    field.onChange(checked
                                                        ? [...selected, id]
                                                        : selected.filter((v) => v !== id))
                                                }}
                                            />
                                        )
                                    })}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )
                    }}
                />
            )}
        </SectionCard>
    )
}
