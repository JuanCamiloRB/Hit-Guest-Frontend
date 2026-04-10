"use client"

import { useEffect, useState, Suspense } from "react"
import { useParams } from "next/navigation"
import { PropertyForm } from "@/features/properties/components/PropertyForm"
import { propertiesService } from "@/features/properties/services/properties-service"
import { listingsService } from "@/features/properties/services/listings-service"
import { apiResponseToFormData } from "@/features/properties/types"
import { Property } from "@/types"
import { Loader2 } from "lucide-react"

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
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Cargando detalles de la propiedad...</p>
            </div>
        )
    }

    if (!property) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <h2 className="text-2xl font-bold">Propiedad no encontrada</h2>
                <p className="text-muted-foreground">La propiedad que buscas no existe o ha sido eliminada.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Gestionar Propiedad</h2>
                <p className="text-muted-foreground">
                    Edita los detalles, unidades y configuraciones de {property.name}.
                </p>
            </div>
            <Suspense fallback={<div className="h-20 w-full animate-pulse bg-slate-100 rounded-lg" />}>
                <PropertyForm initialData={property} />
            </Suspense>
        </div>
    )
}
