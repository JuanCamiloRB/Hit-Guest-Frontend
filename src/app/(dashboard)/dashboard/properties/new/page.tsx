import { Metadata } from "next"
import { Suspense } from "react"
import { PropertyForm } from "@/features/properties/components/PropertyForm"
import { Skeleton } from "@/components/ui/skeleton"
import { Page, PageHeader } from "@/components/ui/page"

export const metadata: Metadata = {
    title: "Nueva Propiedad - Hit Guest",
    description: "Añadir una nueva propiedad",
}

export default function NewPropertyPage() {
    return (
        <Page>
            <PageHeader title="Nueva Propiedad" />
            <Suspense fallback={<Skeleton className="h-20 w-full rounded-lg" />}>
                <PropertyForm />
            </Suspense>
        </Page>
    )
}
