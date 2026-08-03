import { z } from "zod"

export const loginSchema = z.object({
    email: z.string().email({
        message: "Por favor, introduce un correo electrónico válido.",
    }),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const otpSchema = z.object({
    otp: z.string().length(6, {
        message: "El código OTP debe tener 6 dígitos.",
    }),
})

export type OtpFormData = z.infer<typeof otpSchema>

export const registerSchema = z.object({
    person_type_id: z.string().min(1, "Debes seleccionar un tipo de perfil"),
    identificationTypeId: z.string().min(1, "Debes seleccionar un tipo de identificación"),
    identificationNumber: z.string().min(3, "El número es requerido").max(30, "Máximo 30 caracteres"),
    companyName: z.string().optional(),
    name: z.string().min(2, "El nombre es requerido"),
    lastname: z.string().min(2, "El apellido es requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().min(5, "El teléfono es requerido"),
    country: z.string().min(2, "El país es requerido"),
    state: z.string().min(2, "El estado es requerido"),
    city: z.string().min(2, "La ciudad es requerida"),
}).superRefine((data, ctx) => {
    if (data.person_type_id === "2") {
        if (!data.companyName || data.companyName.trim().length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "La razón social es requerida para empresas",
                path: ["companyName"],
            });
        }
    }
})

export type RegisterFormData = z.infer<typeof registerSchema>

export type PermissionAction = "READ" | "CREATE" | "UPDATE" | "DELETE"
export type PermissionModule = "RESERVATIONS" | "PROPERTIES" | "USERS" | "BILLING"

export interface Permission {
    module: PermissionModule
    actions: PermissionAction[]
}

export type UserRole = "PRINCIPAL" | "SECONDARY_MANAGER" | "SECONDARY_STAFF" | "VIEWER"

export interface Client {
    id: string
    name: string
    taxId?: string
    address?: string
    city?: string
    country?: string
    phone?: string
    email?: string
    status: "ACTIVE" | "INACTIVE"
}

export interface RoleDefinition {
    id: UserRole
    name: string
    permissions: Permission[]
}

export interface User {
    id: string
    clientId: string // New: Links user to a Client
    uuid?: string // from API
    token?: string // from API
    email: string
    firstName: string
    phone?: string
    address?: string
    city?: string
    country?: string
    avatar?: string
    role: UserRole
    isPrincipal: boolean
    /**
     * Account owner flag from GET /user (`isAccountOwner`). The owner is the single
     * property_manager who controls sensitive account actions (transfer, delete
     * account/users, grant property_manager). Drives owner-gated UI.
     */
    isAccountOwner?: boolean
    /** Client (CLIENTE) uuid — same as clientId; kept explicit for clarity in owner flows. */
    clientUuid?: string
    permissions?: {
        reservations?: string[]
        properties?: string[]
    }
}

/** Team roles as the backend assigns them (Spatie). Role is NOT yet returned per
 *  user in UserResource — used for create/edit selectors only. */
export type TeamRole = "property_manager" | "property_staff" | "read_only"

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
    property_manager: "Administrador",
    property_staff: "Staff de Apoyo",
    read_only: "Solo lectura",
}

export interface AuthState {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
}

/** Payload for updating the signed-in PM's own profile. Email is immutable. */
/**
 * The CLIENTE record behind "Mi cuenta". Registration creates a CLIENTE (the
 * billable account) plus a PM USUARIO attached to it; this view edits the client.
 * Ids are kept as strings ("" when unset) to match catalog-keyed Selects.
 */
export interface ClientProfile {
    personTypeId: string
    name: string
    lastname: string
    identificationTypeId: string
    identificationNumber: string
    email: string
    phone: string
    address: string
    addressDetail: string
    city: string
    state: string
    countryId: string
}

/** Editable client fields for PATCH /account (email is immutable, never sent). */
export type UpdateProfilePayload = Omit<ClientProfile, "email">

/**
 * The client account as read from GET /account: the editable profile fields plus
 * the client's uuid (needed for /clients/{uuid}/logo) and its optional logo URL.
 * `logoUrl` is null when the client has no logo (the backend omits the key).
 */
export interface ClientAccount {
    profile: Partial<ClientProfile>
    uuid: string | null
    logoUrl: string | null
}

export interface AuthService {
    requestOtp(email: string): Promise<void>
    verifyOtp(email: string, otp: string): Promise<User>
    resendOtp(email: string): Promise<void>
    register(data: RegisterFormData): Promise<void> // Request registration (sends OTP)
    updateProfile(clientUuid: string, payload: UpdateProfilePayload): Promise<void>
    loginWithGoogle(): Promise<User>
    logout(): Promise<void>
}

// Predefined Roles for MVP
export const PREDEFINED_ROLES: RoleDefinition[] = [
    {
        id: "PRINCIPAL",
        name: "Administrador",
        permissions: [
            { module: "RESERVATIONS", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "PROPERTIES", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "USERS", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "BILLING", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
        ]
    },
    {
        id: "SECONDARY_MANAGER",
        name: "Secundario",
        permissions: [
            { module: "RESERVATIONS", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "PROPERTIES", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
        ]
    },
    {
        id: "SECONDARY_STAFF",
        name: "Staff de Apoyo",
        permissions: [
            { module: "RESERVATIONS", actions: ["READ", "CREATE"] },
            { module: "PROPERTIES", actions: ["READ"] },
        ]
    }
]
