import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import type { TeamRole, User } from "@/features/auth/types"

/**
 * Team users — the USUARIOS attached to the signed-in CLIENTE account.
 * Backend endpoints (scoped to the caller's client_id automatically):
 *   GET    /users                → list (paginated)
 *   POST   /users                → create ({ client_uuid, name, email, password, role })
 *   PATCH  /users/{uuid}         → update ({ client_uuid, name?, email?, password?, role? })
 *   DELETE /users/{uuid}         → soft-delete (owner only)
 *
 * ⚠️ The user's ROLE is NOT returned in UserResource yet (backend pending), so
 * `role` on the mapped User is always undefined for now. `isAccountOwner` IS
 * returned and drives the owner badge + owner-gated actions.
 */

/** Maps a backend UserResource into our app User shape. */
function mapUser(u: any): User {
    return {
        id: u.uuid ?? u.id ?? "",
        uuid: u.uuid ?? undefined,
        clientId: u.client_uuid ?? u.clientUuid ?? "",
        clientUuid: u.client_uuid ?? u.clientUuid ?? undefined,
        email: u.email ?? "",
        firstName: u.name ?? "",
        role: undefined as unknown as User["role"], // not exposed by the backend yet
        isPrincipal: !!u.isAccountOwner,
        isAccountOwner: !!u.isAccountOwner,
    }
}

export interface CreateUserPayload {
    clientUuid: string
    name: string
    email: string
    password: string
    role: TeamRole
}

// NOTE: user EDIT (PATCH /users/{uuid}) is intentionally not wired. Changing a
// user's email = a different identity → needs an OTP re-verification flow that
// doesn't exist yet. Re-add updateUser here when that flow lands.

export interface UserService {
    getUsers(search?: string): Promise<User[]>
    createUser(payload: CreateUserPayload): Promise<User>
    deleteUser(uuid: string): Promise<void>
}

class UserServiceImpl implements UserService {
    async getUsers(search?: string): Promise<User[]> {
        const qs = new URLSearchParams()
        if (search?.trim()) qs.set("name[has]", search.trim())
        const url = `${API_BASE}/users${qs.toString() ? `?${qs}` : ""}`
        const res = await apiClient.get<any>(url)
        // apiClient unwraps `data`, so a paginated body arrives as the array itself.
        const items = Array.isArray(res) ? res : res?.data ?? []
        return items.map(mapUser)
    }

    async createUser(payload: CreateUserPayload): Promise<User> {
        const res = await apiClient.post<any>(`${API_BASE}/users`, {
            client_uuid: payload.clientUuid,
            name: payload.name,
            email: payload.email,
            password: payload.password,
            role: payload.role,
        })
        return mapUser(res?.data ?? res)
    }

    async deleteUser(uuid: string): Promise<void> {
        await apiClient.delete<void>(`${API_BASE}/users/${uuid}`)
    }
}

export const userService = new UserServiceImpl()
