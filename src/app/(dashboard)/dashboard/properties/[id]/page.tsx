"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PropertyForm } from "@/features/properties/components/PropertyForm"
import { getPropertyById } from "@/features/properties/services/properties"
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
                const data = await getPropertyById(id)
                setProperty(data)
            } catch (error) {
                console.error("Error loading property:", error)
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
            <PropertyForm initialData={property} />
        </div>
    )
}
