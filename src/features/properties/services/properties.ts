import { Property, Unit } from "@/types"

export const mockProperties: Property[] = [
    {
        id: "1",
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        name: "Hotel Oasis",
        internalName: "HOTEL_OASIS_CARTAGENA",
        description: "Un oasis de tranquilidad en el corazón de Cartagena.",
        type: "HOTEL",
        status: "ACTIVE",
        thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
        address: {
            line1: "Calle 10 # 5-20",
            city: "Cartagena",
            country: "Colombia",
            postal_code: "130001",
            state: "Bolívar"
        },
        geoLocation: {
            latitude: 10.3910,
            longitude: -75.4794
        },
        startPrice: 250000,
        currency: "COP",
        timeZone: "America/Bogota",
        rating: {
            average: 4.8,
            count: 120
        },
        roomTypes: [
            { id: "rt-1", name: "Suite Junior" },
            { id: "rt-2", name: "Habitación Estándar" }
        ]
    },
    {
        id: "2",
        createdAt: "2024-01-05T10:00:00Z",
        updatedAt: "2024-01-06T15:00:00Z",
        name: "Edificio Atalaya",
        internalName: "ATALAYA_MEDELLIN",
        description: "Vistas espectaculares y comodidad moderna.",
        type: "BUILDING",
        status: "ACTIVE",
        thumbnailUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=60",
        address: {
            line1: "Cra 43 # 12-10",
            city: "Medellin",
            country: "Colombia",
            postal_code: "050021",
            state: "Antioquia"
        },
        geoLocation: {
            latitude: 6.2442,
            longitude: -75.5812
        },
        startPrice: 450000,
        currency: "COP",
        timeZone: "America/Bogota",
        rating: {
            average: 4.5,
            count: 85
        },
        roomTypes: [
            { id: "rt-3", name: "Apartamento 1 Habitación" },
            { id: "rt-4", name: "Apartamento 2 Habitaciones" }
        ]
    }
]

export const mockUnits: Unit[] = [
    {
        id: "unit-101",
        propertyId: "1",
        name: "Suite Junior",
        number: "101",
        type: "PRIVATE_ROOM",
        capacity: 2,
        amenities: ["TV", "Aire Acondicionado", "Minibar"],
        pricePerNight: 250000,
        status: "ACTIVE",
        inheritWifi: true,
    },
    {
        id: "unit-102",
        propertyId: "1",
        name: "Suite Junior",
        number: "102",
        type: "PRIVATE_ROOM",
        capacity: 2,
        amenities: ["TV", "Aire Acondicionado", "Minibar"],
        pricePerNight: 250000,
        status: "ACTIVE",
        inheritWifi: true,
    },
    {
        id: "unit-301",
        propertyId: "2",
        name: "301 Edificio Atalaya",
        number: "301",
        type: "ENTIRE_PLACE",
        capacity: 4,
        amenities: ["Cocina", "Wifi", "Lavadora"],
        pricePerNight: 450000,
        status: "ACTIVE",
        inheritWifi: true,
    }
]

export async function getPropertyById(id: string): Promise<Property | null> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))
    const property = mockProperties.find((p) => p.id === id)
    return property || null
}

export async function updateProperty(id: string, data: Partial<Property>): Promise<Property> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800))
    console.log(`Updating property ${id} with data:`, data)
    return { ...mockProperties[0], ...data, id }
}

export async function deleteProperty(id: string): Promise<void> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800))
    console.log(`Deleting property ${id}`)
}

export async function getUnitsByPropertyId(propertyId: string): Promise<Unit[]> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))
    return mockUnits.filter((u) => u.propertyId === propertyId)
}
