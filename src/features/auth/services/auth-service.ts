import { AuthService, LoginFormData, RegisterFormData, User } from "../types"
<<<<<<< Updated upstream
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

=======
import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

const ERROR_MAPPINGS: Record<string, string> = {
    "errors.validation.client.identification_number.exists": "Este número de identificación ya está registrado.",
    "errors.validation.client.identificationNumber.exists": "Este número de identificación ya está registrado.",
    "The email has already been taken.": "Este correo electrónico ya está en uso.",
    "email_already_registered": "Este correo electrónico ya está en uso.",
    "auth.otp.invalid": "El código ingresado es inválido o ha expirado.",
    "auth.otp.expired": "El código ha expirado, por favor solicita uno nuevo.",
}

const translateError = (msg: string | string[]): string => {
    if (Array.isArray(msg)) return msg.map(m => translateError(m)).join(" \n ")
    const trimmed = msg.trim()
    return ERROR_MAPPINGS[trimmed] || trimmed
}

>>>>>>> Stashed changes
class AuthServiceImpl implements AuthService {
    async requestOtp(email: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase()
        try {
<<<<<<< Updated upstream
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
=======
            await apiClient.post(`${API_BASE}/auth/login`, { email: normalizedEmail })
>>>>>>> Stashed changes
        } catch (error: any) {
            console.error("[AuthService] requestOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error al solicitar el código")
        }
    }

    async verifyOtp(email: string, otp: string): Promise<User> {
        const normalizedEmail = email.trim().toLowerCase()
        try {
<<<<<<< Updated upstream
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

=======
            const data = await apiClient.post<any>(`${API_BASE}/auth/verify-otp`, { 
                email: normalizedEmail, 
                otp 
            })

>>>>>>> Stashed changes
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
            }
        } catch (error: any) {
            console.error("[AuthService] verifyOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error de verificación")
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
<<<<<<< Updated upstream
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
=======
            await apiClient.post(`${API_BASE}/auth/resend-otp`, { email: normalizedEmail })
>>>>>>> Stashed changes
        } catch (error: any) {
            console.error("[AuthService] resendOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error al reenviar el código")
        }
    }

    async register(data: RegisterFormData): Promise<void> {
<<<<<<< Updated upstream
        // ALWAYS use mock auth for registration until the API is ready
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const finalName = data.person_type_id === "2" ? data.companyName : data.name;
        console.log(`[MOCK API] Registering Client: ${finalName} and Admin: ${data.email}`)
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        this.simulatedOtps.set(data.email, otp)
        console.log(`[MOCK API] OTP for registration (Mock): ${otp}`)
        return

        /* Backend temporarily disabled due to 401 Unauthorized errors
        if (USE_MOCK_AUTH) {
            await new Promise((resolve) => setTimeout(resolve, 1500))
            const finalName = data.person_type_id === "2" ? data.companyName : data.name;
            console.log(`[MOCK API] Registering Client: ${finalName} and Admin: ${data.email}`)
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            this.simulatedOtps.set(data.email, otp)
            console.log(`[MOCK API] OTP for registration (Mock): ${otp}`)
            return
        }

=======
>>>>>>> Stashed changes
        try {

            const phoneCodeObj = COUNTRY_CODES.find(c => c.country === data.phoneCode)
            const numericCode = phoneCodeObj?.code || ""

            const payload = {
                person_type_id: parseInt(data.person_type_id),
                name: data.person_type_id === "2" ? data.companyName : data.name,
                email: data.email,
                phone: `${numericCode}${data.phone}`,
                country: data.country,
            }

<<<<<<< Updated upstream
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
=======
            await apiClient.post(`${API_BASE}/account/register`, payload)
>>>>>>> Stashed changes
        } catch (error: any) {
            console.error("[AuthService] register error:", error)
            const apiError = error.response?.errors 
                ? Object.values(error.response.errors).flat().map((msg: any) => translateError(String(msg))).join(" \n ")
                : (error.response?.message || error.message)
            
            throw new Error(translateError(apiError) || "Error de conexión durante el registro")
        }
        */
    }

    async loginWithGoogle(): Promise<User> {
        throw new Error("Google Login not implemented yet")
    }

    async logout(): Promise<void> {
<<<<<<< Updated upstream
        return Promise.resolve()
=======
        try {
            await apiClient.post(`${API_BASE}/auth/logout`)
        } catch (error) {
            console.error("[AuthService] logout error:", error)
        }
>>>>>>> Stashed changes
    }
}

export const authService = new AuthServiceImpl()
