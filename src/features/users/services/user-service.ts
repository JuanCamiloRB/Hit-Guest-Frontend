import { User, PREDEFINED_ROLES } from "@/features/auth/types"

export const mockUsers: User[] = [
    {
        id: "USR-001",
        email: "admin@hitguest.com",
        firstName: "Juan",
        lastName: "Rodriguez",
        role: "PRINCIPAL",
        isPrincipal: true,
    },
    {
        id: "USR-002",
        email: "manager@hitguest.com",
        firstName: "Camilo",
        lastName: "Gomez",
        role: "SECONDARY_MANAGER",
        isPrincipal: false,
    },
    {
        id: "USR-003",
        email: "staff@hitguest.com",
        firstName: "Lucia",
        lastName: "Perez",
        role: "SECONDARY_STAFF",
        isPrincipal: false,
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
