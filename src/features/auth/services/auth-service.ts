import { AuthService, LoginFormData, User } from "../types"

const API_URL_HIT = process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1"
const API_URL_GUEST = process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1/hitguest"

const API_URL = API_URL_HIT

// TOGGLE THIS VIA .env (NEXT_PUBLIC_ENABLE_MOCKS)
const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true"

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
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            this.simulatedOtps.set(email, otp)
            console.log(`[MOCK API] OTP for ${email}: ${otp}`)
            return
        }

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))

                if (response.status === 404) {
                    throw new Error("No encontramos una cuenta con este correo.")
                }

                throw new Error(errorData.message || "Error al solicitar OTP")
            }
        } catch (error: any) {
            throw new Error(error.message || "Error de conexión")
        }
    }

    async verifyOtp(email: string, otp: string): Promise<User> {
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const storedOtp = this.simulatedOtps.get(email)
            if (otp === storedOtp || (email === "admin@hitguest.com" && otp === "123456")) {
                this.simulatedOtps.delete(email)
                return { ...this.mockUser, email }
            } else {
                throw new Error("Código inválido o expirado (Mock)")
            }
        }

        try {
            const response = await fetch(`${API_URL}/otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))

                if (response.status === 401) {
                    throw new Error("Código inválido o expirado.")
                }

                throw new Error(errorData.message || "Error de verificación")
            }

            const data = await response.json()
            return {
                id: data.user.uuid || "USR-DEFAULT",
                uuid: data.user.uuid,
                token: data.token,
                email: data.user.email,
                firstName: data.user.name || "Usuario",
                lastName: "",
                role: "PRINCIPAL", // Assuming role comes from backend or default
                isPrincipal: true,
            }
        } catch (error: any) {
            throw new Error(error.message || "Error de verificación")
        }
    }

    async resendOtp(email: string): Promise<void> {
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            console.log(`[MOCK API] Resending OTP for ${email}...`)
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            this.simulatedOtps.set(email, otp)
            console.log(`[MOCK API] New OTP: ${otp}`)
            return
        }

        try {
            const response = await fetch(`${API_URL}/resend-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            if (response.status === 429) {
                throw new Error("Por favor espera unos minutos antes de solicitar otro código.")
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || "Error al reenviar OTP")
            }
        } catch (error: any) {
            throw new Error(error.message || "Error de conexión")
        }
    }

    async loginWithGoogle(): Promise<User> {
        throw new Error("Google Login not implemented yet")
    }

    async logout(): Promise<void> {
        return Promise.resolve()
    }
}

export const authService = new AuthServiceImpl()
