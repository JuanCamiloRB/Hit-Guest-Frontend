import { User, PREDEFINED_ROLES } from "@/features/auth/types"

export const mockUsers: User[] = [
    {
        id: "USR-001",
        clientId: "CLT-001",
        email: "admin@hitguest.com",
        firstName: "Juan Rodriguez",
        phone: "+57 300 000 0000",
        address: "Calle 123 #45-67",
        city: "Bogotá",
        country: "Colombia",
        role: "PRINCIPAL",
        isPrincipal: true,
        permissions: {
            reservations: ["READ", "CREATE", "UPDATE", "DELETE"],
            properties: ["READ", "CREATE", "UPDATE", "DELETE"]
        }
    },
    {
        id: "USR-002",
        clientId: "CLT-001",
        email: "manager@hitguest.com",
        firstName: "Camilo Gomez",
        phone: "+57 311 222 3333",
        address: "Av. Siempre Viva 123",
        city: "Medellín",
        country: "Colombia",
        role: "SECONDARY_MANAGER",
        isPrincipal: false,
        permissions: {
            reservations: ["READ", "CREATE", "UPDATE", "DELETE"],
            properties: ["READ", "CREATE", "UPDATE", "DELETE"]
        }
    },
    {
        id: "USR-003",
        clientId: "CLT-001",
        email: "staff@hitguest.com",
        firstName: "Lucia Perez",
        phone: "+57 322 444 5555",
        address: "Carrera 7 #100-20",
        city: "Cali",
        country: "Colombia",
        role: "SECONDARY_STAFF",
        isPrincipal: false,
        permissions: {
            reservations: ["READ", "CREATE"],
            properties: ["READ"]
        }
    }
]

export interface UserService {
    getUsers(): Promise<User[]>
    createUser(user: Omit<User, "id" | "isPrincipal">): Promise<User>
    updateUser(id: string, user: Partial<User>): Promise<User>
    deleteUser(id: string): Promise<void>
}

class UserServiceImpl implements UserService {
    async getUsers(): Promise<User[]> {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return mockUsers
    }

    async createUser(user: Omit<User, "id" | "isPrincipal">): Promise<User> {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const newUser: User = {
            ...user,
            id: `USR-00${mockUsers.length + 1}`,
            isPrincipal: false,
        }
        mockUsers.push(newUser)
        return newUser
    }

    async updateUser(id: string, data: Partial<User>): Promise<User> {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const index = mockUsers.findIndex(u => u.id === id)
        if (index === -1) throw new Error("User not found")
        mockUsers[index] = { ...mockUsers[index], ...data }
        return mockUsers[index]
    }

    async deleteUser(id: string): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 800))
        const index = mockUsers.findIndex(u => u.id === id)
        if (index !== -1) mockUsers.splice(index, 1)
    }
}

export const userService = new UserServiceImpl()
