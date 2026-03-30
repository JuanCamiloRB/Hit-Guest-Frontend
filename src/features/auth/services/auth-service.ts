import { AuthService, LoginFormData, RegisterFormData, User } from "../types"
import { COUNTRY_CODES } from "../constants"
import { useAuthStore } from "@/lib/store/auth-store"

// Base URLs - endpoints are appended below
const API_BASE_HIT = (process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1").trim().replace(/\/$/, '').replace(/\/auth$/, '').replace(/\/hitguest$/, '')
const API_BASE_HITGUEST = (process.env.NEXT_PUBLIC_API_URL_GUEST || `${API_BASE_HIT}/hitguest`).trim().replace(/\/$/, '')

// Constructed endpoints
const API_URL_AUTH = `${API_BASE_HIT}/auth`
const API_URL_ACCOUNT = `${API_BASE_HIT}/account`
const API_URL_CLIENTS = API_BASE_HITGUEST.includes('/clients') ? API_BASE_HITGUEST : `${API_BASE_HITGUEST}/clients`

// TOGGLE THIS VIA .env (NEXT_PUBLIC_ENABLE_MOCKS)
const USE_MOCK_AUTH = (process.env.NEXT_PUBLIC_ENABLE_MOCKS || "").trim() === "true"

const getHeaders = (includeAuth = true) => {
    const headers: any = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Language": "es",
        "X-Locale": "es",
        "X-App-Locale": "es",
    }

    if (includeAuth) {
        const state = useAuthStore.getState()
        const sessionToken = state.user?.token
        const envToken = (process.env.NEXT_PUBLIC_APP_API_TOKEN || "").trim()
        
        // Prioritize session token from login
        const token = sessionToken || envToken
        
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }
    }

    return headers
}

const ERROR_MAPPINGS: Record<string, string> = {
    "errors.validation.client.identification_number.exists": "Este número de identificación ya está registrado.",
    "errors.validation.client.identificationNumber.exists": "Este número de identificación ya está registrado.",
    "The email has already been taken.": "Este correo electrónico ya está en uso.",
    "email_already_registered": "Este correo electrónico ya está en uso.",
    "auth.otp.invalid": "El código ingresado es inválido o ha expirado.",
    "auth.otp.expired": "El código ha expirado, por favor solicita uno nuevo.",
}

const translateError = (msg: string): string => {
    const trimmed = msg.trim()
    return ERROR_MAPPINGS[trimmed] || trimmed
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

            const response = await fetch(`${API_URL_AUTH}/login`, {
                method: "POST",
                headers,
                body,
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                console.error("[AuthService] Login failed:", errorText)
                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { }

                if (errorData.errors) {
                    const messages = Object.values(errorData.errors).flat().map((msg: any) => translateError(String(msg)))
                    throw new Error(messages.join(" \n "))
                }
                throw new Error(translateError(errorData.message || `Error (${response.status})`))
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
            const response = await fetch(`${API_URL_AUTH}/verify-otp`, {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify({ email: normalizedEmail, otp }),
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { }

                if (errorData.errors) {
                    const messages = Object.values(errorData.errors).flat().map((msg: any) => translateError(String(msg)))
                    throw new Error(messages.join(" \n "))
                }
                throw new Error(translateError(errorData.message || `Error (${response.status})`))
            }

            const data = await response.json()
            const userResponse = data.user || data.data?.user || data
            const token = data.token || data.data?.token || data.access_token

            return {
                id: userResponse?.uuid || userResponse?.id || "USR-DEFAULT",
                clientId: userResponse?.client_uuid || userResponse?.clientId || "CLT-001",
                uuid: userResponse?.uuid || userResponse?.id,
                token: token,
                email: userResponse?.email || normalizedEmail,
                firstName: userResponse?.name || "Usuario",
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
        try {
            const response = await fetch(`${API_URL_AUTH}/resend-otp`, {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify({ email: normalizedEmail }),
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { }

                if (errorData.errors) {
                    const messages = Object.values(errorData.errors).flat().map((msg: any) => translateError(String(msg)))
                    throw new Error(messages.join(" \n "))
                }
                throw new Error(translateError(errorData.message || `Error (${response.status})`))
            }
            
            // MOCK OTP for development as per user request
            this.simulatedOtps.set(normalizedEmail, "000000")
            console.log(`[AuthService] MOCK OTP generated for ${normalizedEmail}: 000000`)
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
                name: data.person_type_id === "2" ? (data.companyName || "").trim() : data.name.trim(),
                lastname: data.person_type_id === "2" ? "-" : (data.lastname?.trim() || "-"),
                identificationTypeId: parseInt(data.identificationTypeId),
                identificationNumber: data.identificationNumber.trim(),
                email: data.email.trim().toLowerCase(),
                phone: data.phone.trim(),
                city: data.city.trim(),
                state: data.state.trim(),
                countryId: parseInt(data.country) || 48,
            }

            const headers = getHeaders()
            console.log("[AuthService] Registration URL:", `${API_URL_ACCOUNT}/register`)
            console.log("[AuthService] Sending registration payload:", payload)
            console.log("[AuthService] Using headers:", headers)

            const response = await fetch(`${API_URL_ACCOUNT}/register`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => "No response body")
                console.error("[AuthService] Registration failed (status " + response.status + "):", errorText)

                let errorData: any = {}
                try { errorData = JSON.parse(errorText) } catch (e) { /* not JSON */ }

                // Collect and translate all validation errors
                if (errorData.errors) {
                    const messages = Object.values(errorData.errors)
                        .flat()
                        .map((msg: any) => translateError(String(msg)))
                    throw new Error(messages.join(" \n "))
                }

                throw new Error(translateError(errorData.message || errorData.error || `Error en el registro (${response.status})`))
            }

            const responseData = await response.json().catch(() => ({}))
            console.log("[AuthService] Registration successful response:", responseData)
            console.log("[AuthService] Registration successful, OTP should have been sent to:", data.email)

            // MOCK OTP for development as per user request
            this.simulatedOtps.set(data.email.trim().toLowerCase(), "000000")
            console.log(`[AuthService] MOCK OTP generated for ${data.email}: 000000`)
        } catch (error: any) {
            console.error("[AuthService] Registration exception:", error)
            throw new Error(error.message || "Error de conexión durante el registro")
        }
    }

    async loginWithGoogle(): Promise<User> {
        throw new Error("Google Login not implemented yet")
    }

    async logout(): Promise<void> {
        if (USE_MOCK_AUTH) return Promise.resolve()
        
        try {
            const response = await fetch(`${API_URL_AUTH}/logout`, {
                method: "POST",
                headers: getHeaders(true)
            })
            console.log("[AuthService] Logout response status:", response.status)
        } catch (error) {
            console.error("[AuthService] Logout error:", error)
        }
    }
}

export const authService = new AuthServiceImpl()
