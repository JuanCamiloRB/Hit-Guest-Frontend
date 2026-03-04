import { Client } from "@/features/auth/types"

export interface ClientService {
    getClient(id: string): Promise<Client>
    updateClient(id: string, data: Partial<Client>): Promise<Client>
}

// Mock implementation
const mockClient: Client = {
    id: "client-1",
    name: "Hotel Paraíso",
    taxId: "900.123.456-1",
    address: "Calle Principal #123",
    city: "Santa Marta",
    country: "Colombia",
    phone: "+57 300 123 4567",
    email: "contacto@hotelparaiso.com",
    status: "ACTIVE"
}

export const clientService: ClientService = {
    async getClient(id: string): Promise<Client> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(mockClient), 500)
        })
    },
    async updateClient(id: string, data: Partial<Client>): Promise<Client> {
        return new Promise((resolve) => {
            setTimeout(() => {
                Object.assign(mockClient, data)
                resolve(mockClient)
            }, 1000)
        })
    }
}
