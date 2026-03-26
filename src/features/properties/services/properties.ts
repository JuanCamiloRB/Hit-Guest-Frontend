import { Property, Unit } from "@/types"

const STORAGE_KEYS = {
    PROPERTIES: 'hit_guest_properties',
    UNITS: 'hit_guest_units'
}

export const mockProperties: Property[] = [
    {
        id: 1,
        user_id: 1,
        name: "Hotel Oasis",
        description: "Un oasis de tranquilidad en el corazón de Cartagena.",
        email: "info@hoteloasis.com",
        address: "Calle 10 # 5-20",
        city: "Cartagena",
        state: "Bolívar",
        country_id: 1,
        geo_location: "10.3910,-75.4794",
        timezone: "America/Bogota",
        status_record_id: 1,
        created_at: "2024-01-01T12:00:00Z",
        updated_at: "2024-01-01T12:00:00Z",
        extra: {
            internalName: "HOTEL_OASIS_CARTAGENA",
            type: "HOTEL",
            thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
            startPrice: 250000,
            currency: "COP",
            rating: {
                average: 4.8,
                count: 120
            },
            roomTypes: [
                { id: "rt-1", name: "Suite Junior" },
                { id: "rt-2", name: "Habitación Estándar" }
            ]
        }
    },
    {
        id: 2,
        user_id: 1,
        name: "Edificio Atalaya",
        description: "Vistas espectaculares y comodidad moderna.",
        email: "contacto@atalaya.com",
        address: "Cra 43 # 12-10",
        city: "Medellin",
        state: "Antioquia",
        country_id: 1,
        geo_location: "6.2442,-75.5812",
        timezone: "America/Bogota",
        status_record_id: 1,
        created_at: "2024-01-05T10:00:00Z",
        updated_at: "2024-01-06T15:00:00Z",
        extra: {
            internalName: "ATALAYA_MEDELLIN",
            type: "BUILDING",
            thumbnailUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=60",
            startPrice: 450000,
            currency: "COP",
            rating: {
                average: 4.5,
                count: 85
            },
            roomTypes: [
                { id: "rt-3", name: "Apartamento 1 Habitación" },
                { id: "rt-4", name: "Apartamento 2 Habitaciones" }
            ]
        }
    }
]

export const mockUnits: Unit[] = [
    {
        id: 101,
        user_id: 1,
        property_id: 1,
        name: "Suite Junior",
        room_type_id: 1,
        thumbnail_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
        contact_name: "Admin",
        status_record_id: 1,
        extra: {
            rooms: [{ id: "R-101", name: "Principal", roomNumber: 101 }],
            maxOccupancy: 2,
            amenities: [{ id: 1, name: "TV" }, { id: 2, name: "Aire Acondicionado" }, { id: 3, name: "Minibar" }],
            startPrice: 250000,
            status: "ACTIVE",
        },
    },
    {
        id: 102,
        user_id: 1,
        property_id: 1,
        name: "Suite Junior",
        room_type_id: 1,
        thumbnail_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
        contact_name: "Admin",
        status_record_id: 1,
        extra: {
            rooms: [{ id: "R-102", name: "Principal", roomNumber: 102 }],
            maxOccupancy: 2,
            amenities: [{ id: 1, name: "TV" }, { id: 2, name: "Aire Acondicionado" }, { id: 3, name: "Minibar" }],
            startPrice: 250000,
            status: "ACTIVE",
        },
    },
    {
        id: 301,
        user_id: 1,
        property_id: 2,
        name: "301 Edificio Atalaya",
        room_type_id: 2,
        thumbnail_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=60",
        contact_name: "Admin",
        status_record_id: 1,
        extra: {
            rooms: [{ id: "R-301", name: "Principal", roomNumber: 301 }],
            maxOccupancy: 4,
            amenities: [{ id: 4, name: "Cocina" }, { id: 5, name: "Wifi" }, { id: 6, name: "Lavadora" }],
            startPrice: 450000,
            status: "ACTIVE",
        },
    }
]

// Persistence Helpers
const getStoredData = (key: string) => {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(key)
        if (!stored) return []
        const parsed = JSON.parse(stored)
        console.log(`Retrieved ${key}:`, parsed)
        return Array.isArray(parsed) ? parsed : []
    } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error)
        return []
    }
}

const setStoredData = (key: string, data: any) => {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(key, JSON.stringify(data))
        console.log(`Saved ${key} to localStorage`)
    } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error)
    }
}

export async function getProperties(): Promise<Property[]> {
    const stored = getStoredData(STORAGE_KEYS.PROPERTIES)
    return [...mockProperties, ...stored]
}

export async function getPropertyById(id: number | string): Promise<Property | null> {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const all = await getProperties()
    return all.find((p) => String(p.id) === String(id)) || null
}

export async function createProperty(data: any): Promise<Property> {
    await new Promise((resolve) => setTimeout(resolve, 800))
    const stored = getStoredData(STORAGE_KEYS.PROPERTIES)
    const newProperty = {
        ...data,
        id: Date.now(), // Real ID generation would be backend-side
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
    setStoredData(STORAGE_KEYS.PROPERTIES, [...stored, newProperty])
    return newProperty
}

export async function updateProperty(id: number | string, data: Partial<Property>): Promise<Property> {
    await new Promise((resolve) => setTimeout(resolve, 800))
    
    // If it's a mock property, we save a copy in localStorage to "override" it
    const stored = getStoredData(STORAGE_KEYS.PROPERTIES)
    const index = stored.findIndex((p: any) => String(p.id) === String(id))
    
    if (index !== -1) {
        stored[index] = { ...stored[index], ...data, updated_at: new Date().toISOString() }
        setStoredData(STORAGE_KEYS.PROPERTIES, stored)
        return stored[index]
    } else {
        // It's a mock property being updated for the first time
        const mock = mockProperties.find(p => String(p.id) === String(id))
        if (!mock) throw new Error("Property not found")
        const updated = { ...mock, ...data, updated_at: new Date().toISOString() }
        setStoredData(STORAGE_KEYS.PROPERTIES, [...stored, updated])
        return updated
    }
}

export async function deleteProperty(id: number | string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 800))
    const stored = getStoredData(STORAGE_KEYS.PROPERTIES)
    const filtered = stored.filter((p: any) => String(p.id) !== String(id))
    setStoredData(STORAGE_KEYS.PROPERTIES, filtered)
    
    // Note: In a real app, mock properties wouldn't be deletable this way if they are hardcoded.
    // For this demo, we'll just ignore if it was a mock property.
}

export async function togglePropertyStatus(id: number | string, currentStatus: number): Promise<Property> {
    const newStatus = currentStatus === 1 ? 2 : 1
    return updateProperty(id, { status_record_id: newStatus })
}

export async function getUnits(): Promise<Unit[]> {
    const properties = await getProperties()
    const unitsFromProperties = properties.flatMap(p => (p as any).units || [])
    const storedUnits = getStoredData(STORAGE_KEYS.UNITS)
    return [...mockUnits, ...unitsFromProperties, ...storedUnits]
}

export async function getUnitsByPropertyId(propertyId: number | string): Promise<Unit[]> {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const all = await getUnits()
    return all.filter((u) => String(u.property_id) === String(propertyId))
}

export async function createUnit(data: any): Promise<Unit> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const stored = getStoredData(STORAGE_KEYS.UNITS)
    const newUnit = {
        ...data,
        id: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
    setStoredData(STORAGE_KEYS.UNITS, [...stored, newUnit])
    return newUnit
}

