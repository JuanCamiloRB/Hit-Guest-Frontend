"use client"

import { useEffect, useState, Suspense } from "react"
import { useParams } from "next/navigation"
import { PropertyForm } from "@/features/properties/components/PropertyForm"
import { propertiesService } from "@/features/properties/services/properties-service"
import { listingsService } from "@/features/properties/services/listings-service"
import { apiResponseToFormData } from "@/features/properties/types"
import { Property } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Heading } from "@/components/ui/heading"
import { Page, PageHeader } from "@/components/ui/page"

export default function EditPropertyPage() {
    const { id } = useParams()
    const [property, setProperty] = useState<Property | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function loadProperty() {
            if (typeof id !== "string") return
            try {
                console.log("[EditPropertyPage] Loading property: ", id)
                
                // Fetch property and listings in parallel for efficiency
                const [apiProperty, listings] = await Promise.all([
                    propertiesService.getByUuid(id),
                    listingsService.listByProperty(id)
                ])
                
                if (!apiProperty) {
                    setProperty(null)
                    return
                }
                
                // Units are saved in extra.units of the property payload.
                // The /listings endpoint will only have entries if listings were
                // created via POST /listings separately (not currently the case).
                // So: prefer API listings if they exist, otherwise let
                // apiResponseToFormData read from extra.units naturally.
                const propertyWithUnits = listings && listings.length > 0
                    ? { ...apiProperty, listings }
                    : apiProperty
                
                // Convert API response to form-ready structure
                const formData = apiResponseToFormData(propertyWithUnits)
                
                // Ensure uuid is preserved for the form's update logic
                const formInitialData = {
                    ...formData,
                    uuid: id
                }
                
                setProperty(formInitialData as any)
            } catch (error) {
                console.error("[EditPropertyPage] Error loading property data:", error)
                setProperty(null)
            } finally {
                setIsLoading(false)
            }
        }
        loadProperty()
    }, [id])

    if (isLoading) {
        return (
            // Esqueleto con la forma de la ficha (título, pestañas, formulario).
            <Page aria-busy>
                <span className="sr-only" role="status">Cargando la propiedad…</span>
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </Page>
        )
    }

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
                <Heading level={1}>Propiedad no encontrada</Heading>
                <p className="text-ink-3">La propiedad que buscas no existe o ha sido eliminada.</p>
            </div>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Gestionar Propiedad"
                description={`Edita los detalles, unidades y configuraciones de ${property.name}.`}
            />
            <Suspense fallback={<Skeleton className="h-20 w-full rounded-lg" />}>
                <PropertyForm initialData={property} />
            </Suspense>
        </Page>
    )
}
