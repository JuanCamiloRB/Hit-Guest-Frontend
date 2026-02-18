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

export type PermissionAction = "READ" | "CREATE" | "UPDATE" | "DELETE"
export type PermissionModule = "RESERVATIONS" | "PROPERTIES" | "USERS" | "BILLING"

export interface Permission {
    module: PermissionModule
    actions: PermissionAction[]
}

export type UserRole = "PRINCIPAL" | "SECONDARY_MANAGER" | "SECONDARY_STAFF" | "VIEWER"

export interface RoleDefinition {
    id: UserRole
    name: string
    permissions: Permission[]
}

export interface User {
    id: string
    uuid?: string // from API
    token?: string // from API
    email: string
    firstName: string
    lastName: string
    avatar?: string
    role: UserRole
    isPrincipal: boolean
}

export interface AuthState {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
}

export interface AuthService {
    requestOtp(email: string): Promise<void>
    verifyOtp(email: string, otp: string): Promise<User>
    resendOtp(email: string): Promise<void> // Added
    loginWithGoogle(): Promise<User>
    logout(): Promise<void>
}

// Predefined Roles for MVP
export const PREDEFINED_ROLES: RoleDefinition[] = [
    {
        id: "PRINCIPAL",
        name: "Usuario Principal (Admin)",
        permissions: [
            { module: "RESERVATIONS", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "PROPERTIES", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "USERS", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
            { module: "BILLING", actions: ["READ", "CREATE", "UPDATE", "DELETE"] },
        ]
    },
    {
        id: "SECONDARY_MANAGER",
        name: "Gestor Secundario",
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
