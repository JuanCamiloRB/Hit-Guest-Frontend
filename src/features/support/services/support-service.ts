/**
 * Consola de soporte: buscar clientes, ver sus usuarios, abrir y cerrar una
 * sesión de soporte y administrar agentes (contrato de backend 2026-10-10,
 * skill de contratos §5b).
 *
 * Nada de esto se llama si la sesión no trae el flag correspondiente; con un
 * backend que no los emite, la UI queda oculta.
 *
 * Las listas paginadas usan `fetch` directo porque `apiClient` desenvuelve
 * `data` y descarta `meta` (mismo motivo que `automationService.listProviders`).
 */

import { apiClient, handleSessionExpired, localeHeaders } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError, type ApiErrorResponse } from "@/types/api"
import {
    readPageMeta,
    readStartedSupportSession,
    readSupportAgent,
    readSupportClient,
    readSupportClientUser,
    readSupportSession,
    type Page,
    type StartedSupportSession,
    type SupportAgent,
    type SupportClient,
    type SupportClientUser,
    type SupportSession,
} from "../lib/support-readers"

async function getPage<T>(url: string, read: (raw: unknown) => T | null): Promise<Page<T>> {
    const token = useAuthStore.getState().user?.token
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
            ...localeHeaders(),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
    })
    const json: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
        if (res.status === 401) handleSessionExpired()
        throw new ApiError(res.status, (json ?? { message: `HTTP ${res.status}` }) as ApiErrorResponse)
    }
    const { items } = readRows(json, read, url)
    return { items, meta: readPageMeta(json, items.length) }
}

/** Un 2xx sin arreglo no es «no hay nada»: es un fallo del contrato. */
function readRows<T>(json: unknown, read: (raw: unknown) => T | null, url: string): { items: T[] } {
    const data = Array.isArray(json) ? json : (json as { data?: unknown })?.data
    if (!Array.isArray(data)) throw new Error(`Respuesta sin arreglo de datos en ${url}`)
    return {
        items: data.flatMap((row) => {
            const item = read(row)
            return item ? [item] : []
        }),
    }
}

class SupportService {
    listClients(params: { search?: string; page?: number } = {}): Promise<Page<SupportClient>> {
        const qs = new URLSearchParams()
        if (params.search?.trim()) qs.set("search", params.search.trim())
        qs.set("page", String(params.page ?? 1))
        return getPage(`${API_BASE}/support/clients?${qs}`, readSupportClient)
    }

    /** Usuarios activos del cliente, dueño primero (el backend ya los ordena). */
    async listClientUsers(clientUuid: string): Promise<SupportClientUser[]> {
        const url = `${API_BASE}/support/clients/${encodeURIComponent(clientUuid)}/users`
        return readRows(await apiClient.get<unknown>(url), readSupportClientUser, url).items
    }

    /** Con el token del AGENTE. Devuelve el token de soporte, la sesión y el usuario objetivo. */
    async startSession(input: { userUuid: string; reason: string }): Promise<StartedSupportSession> {
        const raw = await apiClient.post<unknown>(`${API_BASE}/support/sessions`, input)
        const started = readStartedSupportSession(raw)
        if (!started) throw new Error("La respuesta no trae el token de la sesión de soporte")
        return started
    }

    /** Con el token de SOPORTE: reconstruye el banner tras recargar. */
    async getCurrentSession(): Promise<SupportSession> {
        const session = readSupportSession(await apiClient.get<unknown>(`${API_BASE}/support/sessions/current`))
        if (!session) throw new Error("La respuesta no trae la sesión de soporte")
        return session
    }

    /**
     * Con el token de SOPORTE. Un 401 acá significa que la sesión ya estaba
     * cerrada: no debe disparar la salida global, la decide quien llama.
     */
    async endCurrentSession(): Promise<void> {
        await apiClient.post<void>(`${API_BASE}/support/sessions/current/end`, undefined, {
            suppressUnauthorizedRedirect: true,
        })
    }

    listAgents(page = 1): Promise<Page<SupportAgent>> {
        return getPage(`${API_BASE}/support/agents?page=${page}`, readSupportAgent)
    }

    async createAgent(input: { name: string; email: string }): Promise<SupportAgent> {
        const agent = readSupportAgent(await apiClient.post<unknown>(`${API_BASE}/support/agents`, input))
        if (!agent) throw new Error("La respuesta no trae el agente creado")
        return agent
    }

    /** Quita el rol y cierra su sesión de soporte abierta. El usuario no se borra. */
    async revokeAgent(userUuid: string): Promise<void> {
        await apiClient.delete<void>(`${API_BASE}/support/agents/${encodeURIComponent(userUuid)}`)
    }
}

export const supportService = new SupportService()
