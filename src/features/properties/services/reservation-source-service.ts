/**
 * Reservation Source Service — the booking-channel catalog (Airbnb, Booking,
 * Direct...) used to route contracts and signatures per channel.
 *
 * Endpoint:
 *   GET /api/v1/reservation-sources → list
 *
 * This is deliberately a NEW service, not a reuse of
 * `catalogService.getReservationSources()`. That method hits a different
 * endpoint (`/catalogs?catalogCategoryName[eq]=reservation_source`) and, on an
 * empty response, falls back to HARDCODED ids (14/15/16) that don't match the
 * real catalog (Direct=21, Airbnb=22, Booking.com=23 — per the backend plan).
 * A wrong id here silently routes a contract to the wrong channel, so this
 * service talks to the documented endpoint directly and never invents ids: a
 * failed request is surfaced as an error, not papered over with a guess.
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

export interface ReservationSource {
    id: number
    catalogCategoryId: number
    name: string
    name_translations?: Record<string, string>
    parameters?: Record<string, unknown>
    order: number
    status: string
}

/**
 * Technical integration fallbacks, not real booking channels a PM would route
 * a contract to (per the backend plan's own note). Excluded from the picker.
 */
const EXCLUDED_SOURCE_IDS = new Set([845, 107]) // Calry, Unknown

class ReservationSourceService {
    async list(): Promise<ReservationSource[]> {
        const response = await apiClient.get<ReservationSource[]>(
            `${API_BASE}/reservation-sources`,
        )
        const items = Array.isArray(response) ? response : []
        return items.filter((source) => !EXCLUDED_SOURCE_IDS.has(source.id))
    }
}

export const reservationSourceService = new ReservationSourceService()
