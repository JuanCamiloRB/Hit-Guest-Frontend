import { Metadata } from "next"
import { PropertyForm } from "@/features/properties/components/PropertyForm"

export const metadata: Metadata = {
    title: "Nueva Propiedad - Hit Guest",
    description: "Añadir una nueva propiedad",
}

export default function NewPropertyPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Nueva Propiedad</h2>
            </div>
            <PropertyForm />
        </div>
    )
}
