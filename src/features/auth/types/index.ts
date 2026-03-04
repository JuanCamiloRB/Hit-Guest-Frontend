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
    person_type_id: z.enum(["1", "2"], {
        message: "Debes seleccionar un tipo de perfil",
    }),
    companyName: z.string().optional(),
    name: z.string().min(2, "El nombre es requerido"),
    lastname: z.string().min(1, "El apellido es requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().min(5, "El teléfono es requerido"),
    country: z.string().min(2, "El país es requerido"),
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
    lastName: string
    phone?: string
    address?: string
    city?: string
    country?: string
    avatar?: string
    role: UserRole
    isPrincipal: boolean
    permissions?: {
        reservations?: string[]
        properties?: string[]
    }
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
    resendOtp(email: string): Promise<void>
    register(data: RegisterFormData): Promise<void> // Request registration (sends OTP)
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
