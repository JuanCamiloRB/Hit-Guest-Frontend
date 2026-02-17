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

    private simulatedOtps: Map<string, string> = new Map()

    async requestOtp(email: string): Promise<void> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        this.simulatedOtps.set(email, otp)

        // Simulating Mailgun sending
        console.log("%c--- SIMULATED MAILGUN ---", "color: #ff00ff; font-weight: bold;")
        console.log(`%cTo: ${email}`, "color: #333;")
        console.log(`%cSubject: Tu código de acceso para Hit Guest`, "color: #333;")
        console.log(`%cCódigo OTP: ${otp}`, "color: #00ff00; font-size: 14px; font-weight: bold;")
        console.log("%c---------------------------", "color: #ff00ff; font-weight: bold;")

        // Also log to regular console for easy copy-paste
        console.log(`[SIMULATION] OTP for ${email}: ${otp}`)
    }

    async verifyOtp(email: string, otp: string): Promise<User> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1500))

        const storedOtp = this.simulatedOtps.get(email)

        if (otp === storedOtp || (email === "admin@hitguest.com" && otp === "123456")) {
            console.log(`OTP verified successfully for: ${email}`)
            this.simulatedOtps.delete(email) // Clean up
            return { ...this.mockUser, email: email }
        } else {
            throw new Error("El código OTP es incorrecto o ha expirado")
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
