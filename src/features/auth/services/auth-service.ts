import { AuthService, LoginFormData, RegisterFormData, User } from "../types"

const API_URL_HIT = process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1/auth"
const API_URL_GUEST = process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1/auth"

const API_URL = API_URL_HIT
const APP_API_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN || ""

// TOGGLE THIS VIA .env (NEXT_PUBLIC_ENABLE_MOCKS)
const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true"

const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    ...(APP_API_TOKEN ? { "Authorization": `Bearer ${APP_API_TOKEN}` } : {})
}

class AuthServiceImpl implements AuthService {
    // Simulated "database" user
    private mockUser: User = {
        id: "USR-001",
        clientId: "CLT-001",
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
                headers: DEFAULT_HEADERS,
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
        if (USE_MOCK_AUTH || this.simulatedOtps.has(email)) {
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
            const response = await fetch(`${API_URL}/verify-otp`, {
                method: "POST",
                headers: DEFAULT_HEADERS,
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
            console.log("[AuthService] Verify OTP response:", data)

            const userResponse = data.user || data.data?.user || data
            const token = data.token || data.data?.token || data.access_token

            // Special mapping for the latest API response structure
            const fullName = userResponse?.name || ""
            const nameParts = fullName.trim().split(/\s+/)
            const firstName = nameParts[0] || "Usuario"
            const lastName = nameParts.slice(1).join(" ") || ""

            return {
                id: userResponse?.uuid || userResponse?.id || "USR-DEFAULT",
                clientId: userResponse?.client_uuid || userResponse?.clientId || "CLT-001",
                uuid: userResponse?.uuid || userResponse?.id,
                token: token,
                email: userResponse?.email || email,
                firstName: firstName,
                lastName: lastName,
                role: userResponse?.role || "PRINCIPAL",
                isPrincipal: userResponse?.isPrincipal ?? true,
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
                headers: DEFAULT_HEADERS,
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

    async register(data: RegisterFormData): Promise<void> {
        // FORCE MOCK MODE: The real endpoint does not exist yet
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const finalName = data.person_type_id === "2" ? data.companyName : data.name;
        console.log(`[MOCK API] Registering Client: ${finalName} and Admin: ${data.email}`)
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        this.simulatedOtps.set(data.email, otp)
        console.log(`[MOCK API] OTP for registration: ${otp}`)
        return

        // --- REAL API CODE (Commented out until backend is ready) ---
        /*
        if (USE_MOCK_AUTH) {
            try {
                // Using the exact structure specified in the Clients schema
                // If it's a business (type 2), use companyName as the primary name, 
                // and concatenate name/lastname as the contact's lastname field.
                const finalName = data.person_type_id === "2" ? data.companyName : data.name;
                const finalLastName = data.person_type_id === "2" 
                    ? `${data.name} ${data.lastname}`.trim() 
                    : data.lastname;

                const payload = {
                    person_type_id: data.person_type_id,
                    name: finalName,
                    lastname: finalLastName,
                    email: data.email,
                    phone: data.phone,
                    country: data.country,
                }

                console.log("[AuthService] Sending form payload:", payload)

                const response = await fetch(`${API_URL}/register`, {
                    method: "POST",
                    headers: DEFAULT_HEADERS,
                    body: JSON.stringify(payload),
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error("[AuthService] Registration failed with status:", response.status, errorText)

                    let errorData: any = {}
                    try {
                        errorData = JSON.parse(errorText)
                    } catch (e) {
                        // Not JSON
                    }

                    throw new Error(errorData.message || errorData.error || `Error del servidor (${response.status})`)
                }
            } catch (error: any) {
                console.error("[AuthService] Registration exception:", error)
                throw new Error(error.message || "Error de conexión")
            }
        }
        */
    }

    async loginWithGoogle(): Promise<User> {
        throw new Error("Google Login not implemented yet")
    }

    async logout(): Promise<void> {
        return Promise.resolve()
    }
}

export const authService = new AuthServiceImpl()
