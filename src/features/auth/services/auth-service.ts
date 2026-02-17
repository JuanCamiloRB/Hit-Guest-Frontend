import { AuthService, LoginFormData, User } from "../types"

class AuthServiceImpl implements AuthService {
    // Simulated "database" user
    private mockUser: User = {
        id: "USR-001",
        email: "admin@hitguest.com",
        firstName: "Admin",
        lastName: "User",
        role: "PRINCIPAL",
        isPrincipal: true,
    }

    async loginWithEmail(data: LoginFormData): Promise<User> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Simulating "AuthSuccess" with specific credentials
        if (data.email === "admin@hitguest.com" && data.password === "password123") {
            console.log(`Login successful for: ${data.email}`)
            return { ...this.mockUser, email: data.email }
        } else {
            throw new Error("Credenciales inválidas")
        }
    }

    async loginWithGoogle(): Promise<User> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        console.log("Redirecting to Google...")
        return this.mockUser
    }

    async logout(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 500))
        console.log("Logged out - Sesión terminada")
    }
}

export const authService = new AuthServiceImpl()
