/**
 * Airbnb iCal feed service — contrato del 2026-09-04.
 *
 * Endpoints:
 *   GET    /api/v1/ical/feeds                          → list (paginado, scope del client)
 *   POST   /api/v1/ical/feeds                          → create (201; registra el
 *          externalListingId en el listing y dispara sync inmediato)
 *   PATCH  /api/v1/ical/feeds/{uuid}                   → update (SOLO icalUrl / statusRecordId)
 *   DELETE /api/v1/ical/feeds/{uuid}                   → remove (soft; NO borra reservas)
 *   POST   /api/v1/ical/feeds/{uuid}/sync              → sync (202: encola, no sincroniza en línea)
 *   GET    /api/v1/ical/feeds/{uuid}/message-template  → messageTemplate
 *   GET    /api/v1/providers + POST /api/v1/integrations → connectAirbnb
 *
 * Todo con el token de sesión del PM (datos de cuenta).
 */

import { apiClient, handleSessionExpired } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError, type ApiErrorResponse } from "@/types/api"
import { automationService } from "@/features/properties/services/automation-service"
import type {
    IcalFeed,
    IcalFeedCreatePayload,
    IcalFeedUpdatePayload,
    IcalMessageTemplate,
} from "../types/ical"

function unwrap<T>(res: { data?: T } | T): T {
    return (res as { data?: T })?.data ?? (res as T)
}

class IcalFeedService {
    /**
     * Todos los feeds del client, siguiendo la paginación de Laravel.
     *
     * Con `fetch` directo, NO con `apiClient`: el cliente compartido desenvuelve
     * `{ data }` automáticamente y se traga `meta`, así que con él ni se ven los
     * feeds ni se puede saber cuántas páginas hay. Es exactamente el mismo motivo
     * por el que `automationService.listProviders()` también usa fetch (P0 de la
     * auditoría del 2026-09-07).
     */
    async list(): Promise<IcalFeed[]> {
        const MAX_PAGES = 20
        const all: IcalFeed[] = []
        for (let page = 1; page <= MAX_PAGES; page++) {
            const res = await fetch(`${API_BASE}/ical/feeds?page=${page}`, {
                headers: { Accept: "application/json", ...this.authHeader() },
                cache: "no-store",
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as ApiErrorResponse
                if (res.status === 401) handleSessionExpired()
                // Un listado parcial haría ver un feed configurado como borrado:
                // fallar entero es lo honesto.
                throw new ApiError(res.status, body)
            }
            const json = await res.json()
            all.push(...(Array.isArray(json?.data) ? json.data : []))
            const lastPage = Number(json?.meta?.last_page ?? 1)
            if (page >= lastPage) break
        }
        return all
    }

    private authHeader(): Record<string, string> {
        const token = useAuthStore.getState().user?.token
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    async create(payload: IcalFeedCreatePayload): Promise<IcalFeed> {
        return unwrap(await apiClient.post<{ data?: IcalFeed }>(`${API_BASE}/ical/feeds`, payload))
    }

    async update(uuid: string, payload: IcalFeedUpdatePayload): Promise<IcalFeed> {
        return unwrap(await apiClient.patch<{ data?: IcalFeed }>(`${API_BASE}/ical/feeds/${uuid}`, payload))
    }

    async remove(uuid: string): Promise<void> {
        await apiClient.delete<void>(`${API_BASE}/ical/feeds/${uuid}`)
    }

    /** 202: la sincronización se ENCOLA — refrescar el feed unos segundos después. */
    async sync(uuid: string): Promise<void> {
        await apiClient.post<{ message?: string }>(`${API_BASE}/ical/feeds/${uuid}/sync`, {})
    }

    async messageTemplate(uuid: string): Promise<IcalMessageTemplate> {
        return unwrap(
            await apiClient.get<{ data?: IcalMessageTemplate }>(
                `${API_BASE}/ical/feeds/${uuid}/message-template`,
            ),
        )
    }

    /**
     * Conecta la integración "Airbnb iCal" para el usuario. El providerId se
     * RESUELVE contra `GET /providers` (paginado) — nunca hardcodeado: los ids
     * de provider ya cambiaron entre documentos del backend otras veces.
     * `parameters` va vacío a propósito: la URL del calendario ES el secreto y
     * se registra por listing.
     */
    async connectAirbnb(userUuid: string): Promise<void> {
        const providerId = await this.resolveAirbnbIcalProviderId()
        await apiClient.post(`${API_BASE}/integrations`, {
            userUuid,
            providerId,
            name: "Airbnb",
            parameters: {},
            statusProviderId: 8,
        })
    }

    private async resolveAirbnbIcalProviderId(): Promise<number> {
        // Reusa el paginador ya probado del catálogo de providers (fetch directo,
        // conserva meta) en vez de duplicar la lectura del envelope.
        const providers = await automationService.listProviders()
        const match = providers.find((provider) =>
            /airbnb/i.test(provider.name ?? "") && /ical/i.test(provider.name ?? ""),
        )
        if (match) return match.id
        throw new Error(
            "El proveedor \"Airbnb iCal\" no está disponible en el catálogo. Contacta a soporte de HIT Guest.",
        )
    }
}

export const icalFeedService = new IcalFeedService()
