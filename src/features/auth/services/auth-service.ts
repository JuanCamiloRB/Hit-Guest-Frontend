import { AuthService, RegisterFormData, User } from "../types"
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

class AuthServiceImpl implements AuthService {
    async requestOtp(email: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase()
        try {
            await apiClient.post(`${API_BASE}/auth/login`, { email: normalizedEmail })
        } catch (error: any) {
            console.error("[AuthService] requestOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error al solicitar el código")
        }
    }

    async verifyOtp(email: string, otp: string): Promise<User> {
        const normalizedEmail = email.trim().toLowerCase()
        try {
            const data = await apiClient.post<any>(`${API_BASE}/auth/verify-otp`, { 
                email: normalizedEmail, 
                otp 
            })
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
        try {
            await apiClient.post(`${API_BASE}/auth/resend-otp`, { email: normalizedEmail })
        } catch (error: any) {
            console.error("[AuthService] resendOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error al reenviar el código")
        }
    }

    async register(data: RegisterFormData): Promise<void> {
        try {
            const payload = {
                person_type_id: parseInt(data.person_type_id),
                name: data.person_type_id === "2" ? data.companyName : data.name,
                email: data.email,
                phone: data.phone,
                country: data.country,
                identification_type_id: parseInt(data.identificationTypeId),
                identification_number: data.identificationNumber,
            }
            await apiClient.post(`${API_BASE}/account/register`, payload)
        } catch (error: any) {
            console.error("[AuthService] register error:", error)
            const apiError = error.response?.errors 
                ? Object.values(error.response.errors).flat().map((msg: any) => translateError(String(msg))).join(" \n ")
                : (error.response?.message || error.message)
            
            throw new Error(translateError(apiError) || "Error de conexión durante el registro")
        }
    }

    async loginWithGoogle(): Promise<User> {
        throw new Error("Google Login not implemented yet")
    }

    async logout(): Promise<void> {
        try {
            await apiClient.post(`${API_BASE}/auth/logout`)
        } catch (error) {
            console.error("[AuthService] logout error:", error)
        }
    }
}

export const authService = new AuthServiceImpl()
