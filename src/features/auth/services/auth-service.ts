import { AuthService, ClientAccount, ClientProfile, RegisterFormData, UpdateProfilePayload, User } from "../types"
import { apiClient, handleSessionExpired } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError } from "@/types/api"

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
            // Pre-login: authenticated with the app token, not a session token.
            await apiClient.post(`${API_BASE}/auth/login`, { email: normalizedEmail }, { appAuth: true })
        } catch (error: any) {
            console.error("[AuthService] requestOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error al solicitar el código")
        }
    }

    async verifyOtp(email: string, otp: string): Promise<User> {
        const normalizedEmail = email.trim().toLowerCase()
        try {
            // Pre-login: authenticated with the app token, not a session token.
            const data = await apiClient.post<any>(`${API_BASE}/auth/verify-otp`, {
                email: normalizedEmail,
                otp
            }, { appAuth: true })
            const userResponse = data.user || data.data?.user || data

            // The session token is what scopes every subsequent request to THIS
            // account. If we fail to capture it, api-client falls through to no
            // auth and the user sees nothing (never another account's data).
            // Backends vary in where they put it, so probe every known location
            // — including nested inside the user object.
            const token =
                data?.token ||
                data?.data?.token ||
                data?.access_token ||
                data?.accessToken ||
                data?.data?.access_token ||
                data?.data?.accessToken ||
                userResponse?.token ||
                userResponse?.access_token ||
                userResponse?.accessToken

            if (!token) {
                console.error(
                    "[AuthService] verifyOtp: no session token found in response. " +
                    "Every request will be unauthenticated. Response keys:",
                    Object.keys(data || {}),
                )
            }

            // The verify-otp `user` object already carries client_uuid + isAccountOwner,
            // so mapUserResponse hydrates everything — no extra GET /user needed.
            return mapUserResponse(userResponse, token, normalizedEmail)
        } catch (error: any) {
            console.error("[AuthService] verifyOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error de verificación")
        }
    }

    async resendOtp(email: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase()
        try {
            await apiClient.post(`${API_BASE}/auth/resend-otp`, { email: normalizedEmail }, { appAuth: true })
        } catch (error: any) {
            console.error("[AuthService] resendOtp error:", error)
            const apiError = error.response?.errors || error.response?.message || error.message
            throw new Error(translateError(apiError) || "Error al reenviar el código")
        }
    }

    async register(data: RegisterFormData): Promise<void> {
        try {
            const payload = {
                personTypeId: parseInt(data.person_type_id),
                name: data.person_type_id === "2" ? data.companyName : data.name,
                lastname: data.person_type_id === "2" ? undefined : data.lastname,
                // Same backend contract (`email` string), canonicalized so the
                // register, verify and resend requests all address one value.
                email: data.email.trim().toLowerCase(),
                phone: data.phone,
                countryId: parseInt(data.country) || data.country, // Just in case it's a UUID, keep fallback
                state: data.state,
                city: data.city,
                identificationTypeId: parseInt(data.identificationTypeId),
                identificationNumber: data.identificationNumber,
            }
            await apiClient.post(`${API_BASE}/account/register`, payload, { appAuth: true })
        } catch (error: any) {
            console.error("[AuthService] register error:", error)
            const apiError = error.response?.errors 
                ? Object.values(error.response.errors).flat().map((msg: any) => translateError(String(msg))).join(" \n ")
                : (error.response?.message || error.message)
            
            throw new Error(translateError(apiError) || "Error de conexión durante el registro")
        }
    }

    /**
     * GET /clients/{uuid} — the CLIENTE record for "Mi cuenta" (12 fields + logoUrl).
     * `clientUuid` comes from the session (GET /user). Returns null on failure so the
     * form falls back to session data.
     */
    async getClient(clientUuid: string): Promise<ClientAccount | null> {
        try {
            const data = await apiClient.get<any>(`${API_BASE}/clients/${clientUuid}`)
            const c = data?.client || data?.data?.client || data?.data || data
            if (!c || typeof c !== "object") return null
            const id = (v: unknown) => (v == null ? "" : String(v))
            const profile: Partial<ClientProfile> = {
                personTypeId: id(c.personTypeId ?? c.person_type_id),
                name: c.name ?? "",
                lastname: c.lastname ?? "",
                identificationTypeId: id(c.identificationTypeId ?? c.identification_type_id),
                identificationNumber: c.identificationNumber ?? c.identification_number ?? "",
                email: c.email ?? "",
                phone: c.phone ?? "",
                address: c.address ?? "",
                addressDetail: c.addressDetail ?? c.address_detail ?? "",
                city: c.city ?? "",
                state: c.state ?? "",
                countryId: id(c.countryId ?? c.country_id ?? c.country?.id),
            }
            return {
                profile,
                uuid: c.uuid ?? null,
                // logoUrl is omitted (not null) when the client has no logo.
                logoUrl: c.logoUrl ?? c.logo_url ?? null,
            }
        } catch {
            return null
        }
    }

    /**
     * Uploads (or replaces) the client's logo. `clientUuid` comes from the session / getClient().
     * Multipart raw fetch — FormData sets its own boundary, so no Content-Type here.
     * Returns the new `logoUrl` (the format may change, e.g. png→jpg, so callers
     * must use this value, not reuse the old URL).
     */
    async uploadLogo(clientUuid: string, file: File): Promise<string | null> {
        const url = `${API_BASE}/clients/${clientUuid}/logo`
        const formData = new FormData()
        formData.append("logo", file)

        const token = useAuthStore.getState().user?.token
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-Language": "es",
                "X-Locale": "es",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            if (res.status === 401) handleSessionExpired()
            throw new ApiError(res.status, json)
        }
        const c = json?.data ?? json
        return c?.logoUrl ?? c?.logo_url ?? null
    }

    /** Deletes the client's logo (idempotent — 200 even if none existed). */
    async deleteLogo(clientUuid: string): Promise<void> {
        const url = `${API_BASE}/clients/${clientUuid}/logo`
        const token = useAuthStore.getState().user?.token
        const res = await fetch(url, {
            method: "DELETE",
            headers: {
                Accept: "application/json",
                "Accept-Language": "es",
                "X-Locale": "es",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        })
        if (!res.ok) {
            if (res.status === 401) handleSessionExpired()
            const json = await res.json().catch(() => ({}))
            throw new ApiError(res.status, json)
        }
    }

    /**
     * PATCH /clients/{uuid} — updates the CLIENTE record (all "Mi cuenta" fields).
     * Partial update: any property_manager of the account may edit. Email is
     * immutable and never sent. The backend returns 200 with NO body, so there's
     * nothing to remap — this edits the client, not the signed-in user/session.
     */
    async updateProfile(clientUuid: string, payload: UpdateProfilePayload): Promise<void> {
        try {
            const num = (v: string) => (v ? parseInt(v) : undefined)
            const body = {
                personTypeId: num(payload.personTypeId),
                name: payload.name,
                // Companies (person type 2) have no lastname — mirror register.
                lastname: payload.personTypeId === "2" ? undefined : payload.lastname,
                identificationTypeId: num(payload.identificationTypeId),
                identificationNumber: payload.identificationNumber,
                phone: payload.phone,
                address: payload.address,
                addressDetail: payload.addressDetail,
                city: payload.city,
                state: payload.state,
                countryId: num(payload.countryId),
            }
            await apiClient.patch<any>(`${API_BASE}/clients/${clientUuid}`, body)
        } catch (error: any) {
            console.error("[AuthService] updateProfile error:", error)
            const apiError = error.response?.errors
                ? Object.values(error.response.errors).flat().map((msg: any) => translateError(String(msg))).join(" \n ")
                : (error.response?.message || error.message)
            throw new Error(translateError(apiError) || "No se pudo actualizar el perfil")
        }
    }

    /**
     * POST /clients/{uuid}/transfer-ownership — hands account ownership to another
     * user of the SAME account (`userUuid` must appear in GET /users). The target
     * becomes owner (gaining property_manager if missing); the caller keeps
     * property_manager but stops being owner. Only the current owner may call this.
     * Throws ApiError (403 not-owner / 422 invalid user) — callers map to UI.
     */
    async transferOwnership(clientUuid: string, userUuid: string): Promise<void> {
        await apiClient.post<any>(
            `${API_BASE}/clients/${clientUuid}/transfer-ownership`,
            { user_uuid: userUuid },
        )
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

/**
 * Maps a backend user object into our `User` shape. Shared by verifyOtp and
 * updateProfile so profile fields are hydrated the same way in both paths.
 * `country` is normalised to its id (string) to match the catalog-keyed Select.
 */
function mapUserResponse(
    userResponse: any,
    token: string | undefined,
    fallbackEmail?: string,
): User {
    const country =
        userResponse?.country?.id != null
            ? String(userResponse.country.id)
            : userResponse?.countryId != null
              ? String(userResponse.countryId)
              : userResponse?.country_id != null
                ? String(userResponse.country_id)
                : userResponse?.country
                  ? String(userResponse.country)
                  : ""

    // The backend `user` object is migrating snake_case → camelCase; read both so
    // the transition (client_uuid → clientUuid, etc.) doesn't break the session.
    const clientUuid = userResponse?.clientUuid ?? userResponse?.client_uuid ?? undefined

    return {
        id: userResponse?.uuid || userResponse?.id || "USR-DEFAULT",
        clientId: clientUuid || userResponse?.clientId || "CLT-001",
        uuid: userResponse?.uuid || userResponse?.id,
        token,
        email: userResponse?.email || fallbackEmail || "",
        firstName: userResponse?.name || "Usuario",
        phone: userResponse?.phone || "",
        address: userResponse?.address || "",
        city: userResponse?.city || "",
        country,
        role: userResponse?.role || "PRINCIPAL",
        isPrincipal: userResponse?.isPrincipal ?? true,
        isAccountOwner: userResponse?.isAccountOwner ?? undefined,
        clientUuid,
    }
}

export const authService = new AuthServiceImpl()
