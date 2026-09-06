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

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import type {
    IcalFeed,
    IcalFeedCreatePayload,
    IcalFeedUpdatePayload,
    IcalMessageTemplate,
} from "../types/ical"

interface Paginated<T> {
    data?: T[]
    meta?: { current_page?: number; last_page?: number }
}

function unwrap<T>(res: { data?: T } | T): T {
    return (res as { data?: T })?.data ?? (res as T)
}

class IcalFeedService {
    /** Todos los feeds del client — sigue la paginación estándar de Laravel. */
    async list(): Promise<IcalFeed[]> {
        const all: IcalFeed[] = []
        let page = 1
        let lastPage = 1
        do {
            const res = await apiClient.get<Paginated<IcalFeed>>(`${API_BASE}/ical/feeds?page=${page}`)
            all.push(...(res.data ?? []))
            lastPage = res.meta?.last_page ?? 1
            page += 1
        } while (page <= lastPage)
        return all
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
        let page = 1
        let lastPage = 1
        do {
            const res = await apiClient.get<Paginated<{ id: number; name?: string }>>(
                `${API_BASE}/providers?page=${page}`,
            )
            const match = (res.data ?? []).find((provider) =>
                /airbnb/i.test(provider.name ?? "") && /ical/i.test(provider.name ?? ""),
            )
            if (match) return match.id
            lastPage = res.meta?.last_page ?? 1
            page += 1
        } while (page <= lastPage)
        throw new Error(
            "El proveedor \"Airbnb iCal\" no está disponible en el catálogo. Contacta a soporte de HIT Guest.",
        )
    }
}

export const icalFeedService = new IcalFeedService()
