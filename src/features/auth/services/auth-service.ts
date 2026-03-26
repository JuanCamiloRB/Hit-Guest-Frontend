import { AuthService, LoginFormData, RegisterFormData, User } from "../types"
import { COUNTRY_CODES } from "../constants"

const API_URL_AUTH = (process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1/auth").trim()
const API_URL_CLIENTS = (process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1/clients").trim()

// TOGGLE THIS VIA .env (NEXT_PUBLIC_ENABLE_MOCKS)
const USE_MOCK_AUTH = (process.env.NEXT_PUBLIC_ENABLE_MOCKS || "").trim() === "true"

const getHeaders = (includeAuth = true) => {
    const headers: any = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if (includeAuth) {
        const token = (process.env.NEXT_PUBLIC_APP_API_TOKEN || "").trim()
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }
    }

    return headers
}

class AuthServiceImpl implements AuthService {
    // Simulated "database" user
    private mockUser: User = {
        id: "USR-001",
        clientId: "CLT-001",
        email: "admin@hitguest.com",
        firstName: "Juan Rodriguez",
        role: "PRINCIPAL",
        isPrincipal: true,
    }

    private simulatedOtps: Map<string, string> = new Map()

    async requestOtp(email: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase()
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            this.simulatedOtps.set(normalizedEmail, otp)
            console.log(`[MOCK API] OTP for ${normalizedEmail}: ${otp}`)
            return
        }

        try {
            console.log("[AuthService] Requesting OTP for:", normalizedEmail)
            const headers = getHeaders(true)
            const body = JSON.stringify({ email: normalizedEmail })

            console.log("[AuthService] Request Details:", {
                url: `${API_URL_AUTH}/login`,
                headers,
                body
            })

            const response = await fetch(`${API_URL_AUTH}/login`, {
                method: "POST",
                headers,
                body,
            })

            console.log("[AuthService] Login response status:", response.status)

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                console.error("[AuthService] Login error response:", errorText)

                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { }

                if (response.status === 404) {
                    throw new Error("No encontramos una cuenta con este correo.")
                }

                throw new Error(errorData.message || `Error del servidor (${response.status})`)
            }
        } catch (error: any) {
            console.error("[AuthService] RequestOtp exception:", error)
            throw new Error(error.message || "Error de conexión")
        }
    }

    async verifyOtp(email: string, otp: string): Promise<User> {
        const normalizedEmail = email.trim().toLowerCase()
        if (USE_MOCK_AUTH || (this.simulatedOtps.has(normalizedEmail) && normalizedEmail !== "admin@hitguest.com")) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const storedOtp = this.simulatedOtps.get(normalizedEmail)
            if (otp === storedOtp || (normalizedEmail === "admin@hitguest.com" && otp === "123456")) {
                this.simulatedOtps.delete(normalizedEmail)
                return { ...this.mockUser, email: normalizedEmail }
            } else {
                throw new Error("Código inválido o expirado (Mock)")
            }
        }

        try {
            console.log("[AuthService] Verifying OTP for:", normalizedEmail)
            const headers = getHeaders(true) // Re-enabled: server returns 500 without it
            const body = JSON.stringify({ email: normalizedEmail, otp, otp_code: otp })

            console.log("[AuthService] Verify Request Details:", {
                url: `${API_URL_AUTH}/verify-otp`,
                headers,
                body
            })

            const response = await fetch(`${API_URL_AUTH}/verify-otp`, {
                method: "POST",
                headers,
                body,
            })

            console.log("[AuthService] Verify response status:", response.status)

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                console.error("[AuthService] Verify OTP error response:", errorText)

                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { }

                if (response.status === 401) {
                    throw new Error("Código inválido o expirado.")
                }

                throw new Error(errorData.message || `Error de verificación (${response.status})`)
            }

            const data = await response.json()
            console.log("[AuthService] Verify OTP response:", data)

            const userResponse = data.user || data.data?.user || data
            const token = data.token || data.data?.token || data.access_token

            // Special mapping for the latest API response structure
            const firstName = userResponse?.name || "Usuario"

            return {
                id: userResponse?.uuid || userResponse?.id || "USR-DEFAULT",
                clientId: userResponse?.client_uuid || userResponse?.clientId || "CLT-001",
                uuid: userResponse?.uuid || userResponse?.id,
                token: token,
                email: userResponse?.email || normalizedEmail,
                firstName: firstName,
                role: userResponse?.role || "PRINCIPAL",
                isPrincipal: userResponse?.isPrincipal ?? true,
                language: userResponse?.locale || userResponse?.Locale,
            }
        } catch (error: any) {
            throw new Error(error.message || "Error de verificación")
        }
    }

    async resendOtp(email: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase()
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            console.log(`[MOCK API] Resending OTP for ${normalizedEmail}...`)
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            this.simulatedOtps.set(normalizedEmail, otp)
            console.log(`[MOCK API] New OTP: ${otp}`)
            return
        }

        try {
            console.log("[AuthService] Resending OTP for:", normalizedEmail)
            const headers = getHeaders(true) // Re-enabled: server returns 500 without it
            const body = JSON.stringify({ email: normalizedEmail })

            console.log("[AuthService] Resend Request Details:", {
                url: `${API_URL_AUTH}/resend-otp`,
                headers,
                body
            })

            const response = await fetch(`${API_URL_AUTH}/resend-otp`, {
                method: "POST",
                headers,
                body,
            })

            console.log("[AuthService] Resend response status:", response.status)

            if (response.status === 429) {
                throw new Error("Por favor espera unos minutos antes de solicitar otro código.")
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                console.error("[AuthService] Resend error response:", errorText)
                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { }
                throw new Error(errorData.message || `Error al reenviar OTP (${response.status})`)
            }
        } catch (error: any) {
            console.error("[AuthService] ResendOtp exception:", error)
            throw new Error(error.message || "Error de conexión")
        }
    }

    async register(data: RegisterFormData): Promise<void> {
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const finalName = data.person_type_id === "2" ? data.companyName : data.name;
            console.log(`[MOCK API] Registering Client: ${finalName} and Admin: ${data.email}`)
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            this.simulatedOtps.set(data.email, otp)
            console.log(`[MOCK API] OTP for registration (Mock): ${otp}`)
            return
        }

        try {
            const payload = {
                personTypeId: parseInt(data.person_type_id),
                identificationTypeId: parseInt(data.identificationTypeId),
                identificationNumber: data.identificationNumber,
                name: data.person_type_id === "2" ? data.companyName : data.name,
                lastname: data.person_type_id === "2" ? "-" : (data.lastname || "-"),
                email: data.email,
                phone: data.phone,
                city: data.city,
                state: data.state,
                countryId: parseInt(data.country),
            }

            const headers = getHeaders()
            console.log("[AuthService] Sending registration payload:", payload)
            console.log("[AuthService] Using headers:", headers)

            const response = await fetch(API_URL_CLIENTS, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error("[AuthService] Registration failed:", errorData)
                throw new Error(errorData.message || errorData.error || `Error en el registro (${response.status})`)
            }

            console.log("[AuthService] Registration successful, OTP should have been sent to:", data.email)
        } catch (error: any) {
            console.error("[AuthService] Registration exception:", error)
            throw new Error(error.message || "Error de conexión durante el registro")
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
