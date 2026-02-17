import { Metadata } from "next"
import { PropertiesList } from "@/features/properties/components/PropertiesList"

export const metadata: Metadata = {
    title: "Properties - Hit Guest",
    description: "Manage your properties",
}

export default function PropertiesPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PropertiesList />
        </div>
    )
}
