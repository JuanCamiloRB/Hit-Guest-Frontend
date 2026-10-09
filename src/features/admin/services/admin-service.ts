/**
 * Plano de superusuario: directorio de clientes y suplantación.
 *
 * ⚠️ Endpoints PEDIDOS al backend, todavía inexistentes
 * (`docs/BACKEND_NEEDS_IMPERSONATION.md`). Nada de esto se llama si la sesión
 * no trae la capacidad correspondiente, y hoy ninguna sesión la trae: la UI
 * queda oculta hasta que el backend la emita.
 *
 * Las listas paginadas usan `fetch` directo porque `apiClient` desenvuelve
 * `data` y descarta `meta` (mismo motivo que `automationService.listProviders`).
 */

import { apiClient, handleSessionExpired } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError, type ApiErrorResponse } from "@/types/api"
import {
    readAdminClient,
    readAdminClientUser,
    readPageMeta,
    readStartedImpersonation,
    type AdminClient,
    type AdminClientUser,
    type Page,
    type StartedImpersonation,
} from "../lib/admin-readers"
import type { ImpersonationMode } from "../lib/session-access"

async function getPage<T>(url: string, read: (raw: unknown) => T | null): Promise<Page<T>> {
    const token = useAuthStore.getState().user?.token
    const res = await fetch(url, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache: "no-store",
    })
    const json: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
        if (res.status === 401) handleSessionExpired()
        throw new ApiError(res.status, (json ?? { message: `HTTP ${res.status}` }) as ApiErrorResponse)
    }
    const data = (json as { data?: unknown })?.data
    if (!Array.isArray(data)) {
        // Un 2xx sin arreglo no es «no hay clientes»: es un fallo del contrato.
        throw new Error(`Respuesta sin arreglo de datos en ${url}`)
    }
    const items = data.flatMap((row) => {
        const item = read(row)
        return item ? [item] : []
    })
    return { items, meta: readPageMeta(json, items.length) }
}

class AdminService {
    listClients(params: { search?: string; page?: number } = {}): Promise<Page<AdminClient>> {
        const qs = new URLSearchParams()
        if (params.search?.trim()) qs.set("search", params.search.trim())
        qs.set("page", String(params.page ?? 1))
        return getPage(`${API_BASE}/admin/clients?${qs}`, readAdminClient)
    }

    async getClient(clientUuid: string): Promise<AdminClient> {
        const raw = await apiClient.get<unknown>(`${API_BASE}/admin/clients/${encodeURIComponent(clientUuid)}`)
        const client = readAdminClient(raw)
        if (!client) throw new Error("La respuesta del cliente no trae un uuid utilizable")
        return client
    }

    listClientUsers(clientUuid: string, page = 1): Promise<Page<AdminClientUser>> {
        return getPage(
            `${API_BASE}/admin/clients/${encodeURIComponent(clientUuid)}/users?page=${page}`,
            readAdminClientUser,
        )
    }

    /** Con el token del SUPERUSUARIO: devuelve un token aparte para la cuenta ajena. */
    async startImpersonation(input: {
        userUuid: string
        mode: ImpersonationMode
        reason: string
    }): Promise<StartedImpersonation> {
        // `apiClient` desenvuelve `data`; el lector acepta las dos formas.
        const raw = await apiClient.post<unknown>(`${API_BASE}/admin/impersonations`, input)
        const started = readStartedImpersonation(raw)
        if (!started) throw new Error("La respuesta no trae el token de la suplantación")
        return started
    }

    /** Con el token del SUPERUSUARIO (§2.4): idempotente; un id ajeno responde 404. */
    async revokeImpersonation(impersonationId: string): Promise<void> {
        await apiClient.delete<void>(`${API_BASE}/admin/impersonations/${encodeURIComponent(impersonationId)}`)
    }
}

export const adminService = new AdminService()
