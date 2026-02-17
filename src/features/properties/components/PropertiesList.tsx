"use client"

import { Property } from "@/types"
import { PropertyCard } from "./PropertyCard"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

const mockProperties: Property[] = [
    {
        id: "1",
        name: "Casa Rosada",
        address: "Calle 10 # 5-20",
        city: "Cartagena",
        country: "Colombia",
        status: "ACTIVE",
        imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8aG91c2V8ZW58MHx8MHx8fDA%3D",
    },
    {
        id: "2",
        name: "Apartamento 502",
        address: "Cra 43 # 12-10",
        city: "Medellin",
        country: "Colombia",
        status: "ACTIVE",
        imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXBhcnRtZW50fGVufDB8fDB8fHww",
    },
    {
        id: "3",
        name: "Luxury Villa",
        address: "Vereda El Tablazo",
        city: "Rionegro",
        country: "Colombia",
        status: "INACTIVE",
        imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8dmlsbGF8ZW58MHx8MHx8fDA%3D",
    },
]

export function PropertiesList() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Properties</h2>
                    <p className="text-muted-foreground">
                        Manage your properties, units, and automation settings.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/properties/new">
                        <Plus className="mr-2 h-4 w-4" /> Add Property
                    </Link>
                </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mockProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                ))}
            </div>
        </div>
    )
}
