import "server-only"

import type { CheckinPortalResponse, CheckinReservationV4, SecondaryGateStatus, SmartlockCode } from "../types/checkin"
import { assertRenderablePortal } from "../lib/portal-payload"

const API_BASE = (
    process.env.API_URL_GUEST
    || process.env.NEXT_PUBLIC_API_URL_GUEST
    || "https://guest.hit.tools/api/v1"
).trim().replace(/\/$/, "")

// Server-only compatibility fallback. Rename the deployment variable to
// APP_API_TOKEN; the NEXT_PUBLIC name can then be removed from Vercel.
const APP_TOKEN = process.env.APP_API_TOKEN || process.env.NEXT_PUBLIC_APP_API_TOKEN || ""

/**
 * Desenlaces posibles al resolver el acceso de un acompañante.
 *
 * Existe como unión discriminada porque las cinco páginas de `/s/{guestToken}`
 * tenían la misma cascada copiada dentro de un `try/catch` que además envolvía
 * el JSX. Eso no era solo repetición: `notFound()` y `redirect()` de Next
 * funcionan LANZANDO, así que ese `catch` atrapaba su propia señal de control —
 * el `notFound()` se reemitía por casualidad desde el catch, y el `redirect()`
 * necesitaba un parche que re-lanzaba a mano los errores con digest
 * `NEXT_REDIRECT`. Separando "buscar datos" de "decidir qué renderizar", el
 * try/catch queda acá adentro, acotado a la petición, y las páginas se quedan
 * con control de flujo plano.
 */
export type SecondaryGateResult =
    /** Portal accesible: la política de acceso la decide cada página. */
    | { kind: "ready"; status: SecondaryGateStatus }
    /** Reserva cancelada (29) o eliminada (108) — hay que explicárselo al huésped. */
    | { kind: "portal_closed"; portalStatus: "cancelled" | "deleted"; message?: string }
    /** No se pudo resolver la reserva (404, red, backend caído). */
    | { kind: "unavailable" }

function normalizePortal(portal: CheckinPortalResponse & Record<string, unknown>): CheckinPortalResponse {
    const rawCodes = portal.smartlockCodes ?? portal.smartlock_codes
    return {
        ...portal,
        smartlockCodes: Array.isArray(rawCodes)
            ? rawCodes.map((raw): SmartlockCode => {
                const code = raw as Record<string, unknown>
                const rawType = String(code.type ?? "amenity")
                const type: SmartlockCode["type"] = rawType === "building_entrance" || rawType === "unit_entrance"
                    ? rawType
                    : "amenity"
                return {
                    name: String(code.name ?? "Acceso"),
                    type,
                    code: String(code.code ?? ""),
                    validFrom: String(code.validFrom ?? code.valid_from ?? ""),
                    validUntil: String(code.validUntil ?? code.valid_until ?? ""),
                }
            })
            : undefined,
    }
}

export const checkinServerService = {
    async getPortal(reservationUuid: string): Promise<CheckinPortalResponse> {
        if (!APP_TOKEN) throw new Error("Server APP_API_TOKEN is not configured")
        const response = await fetch(`${API_BASE}/checkin/${encodeURIComponent(reservationUuid)}`, {
            headers: {
                Accept: "application/json",
                "Accept-Language": "es",
                "X-Locale": "es",
                Authorization: `Bearer ${APP_TOKEN}`,
            },
            cache: "no-store",
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json?.message || "Error loading reservation")
        // Un 200 sin el shape renderizable se lanza como si fuera un fallo de
        // red: cada wrapper ya tiene su catch/fallback (incidente 2026-08-20).
        return assertRenderablePortal(
            normalizePortal((json?.data ?? json) as CheckinPortalResponse & Record<string, unknown>),
        )
    },

    /**
     * Resolves a public PMS link through the backend's external lookup endpoint.
     * `sourceSlug` is not a reservation UUID; callers must use the UUID returned
     * in `portal.reservation.uuid` for every subsequent check-in endpoint.
     */
    async getPortalByExternal(
        sourceSlug: string,
        listingUuid: string,
        externalId: string,
    ): Promise<CheckinPortalResponse> {
        if (!APP_TOKEN) throw new Error("Server APP_API_TOKEN is not configured")
        const path = [sourceSlug, listingUuid, externalId]
            .map((segment) => encodeURIComponent(segment))
            .join("/")
        const response = await fetch(`${API_BASE}/checkin/${path}`, {
            headers: {
                Accept: "application/json",
                "Accept-Language": "es",
                "X-Locale": "es",
                Authorization: `Bearer ${APP_TOKEN}`,
            },
            cache: "no-store",
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json?.message || "Error loading reservation")
        // Un 200 sin el shape renderizable se lanza como si fuera un fallo de
        // red: cada wrapper ya tiene su catch/fallback (incidente 2026-08-20).
        return assertRenderablePortal(
            normalizePortal((json?.data ?? json) as CheckinPortalResponse & Record<string, unknown>),
        )
    },

    async getSecondaryGateStatus(reservationUuid: string, guestToken: string): Promise<SecondaryGateStatus> {
        const portal = await this.getPortal(reservationUuid)

        // Reserva cancelada (29) o eliminada (108): el portal responde 200 pero
        // SIN `registeredGuests` (§1 del contrato — decisión explícita del backend
        // de no usar 4xx). Indexarlo tiraba un TypeError que las cinco páginas de
        // acompañante atrapaban como `notFound()`: el huésped veía "no encontrada"
        // en lugar de saber que su reserva fue cancelada. Se propaga el estado
        // para que rendericen la misma pantalla que las rutas del titular.
        if (portal.portalStatus) {
            return {
                mainGuestCompleted: false,
                reservation: {} as CheckinReservationV4,
                guestToken,
                portalStatus: portal.portalStatus,
                portalMessage: portal.message,
            }
        }

        const mainGuest = portal.registeredGuests?.find(guest => guest.isMain)
        return {
            mainGuestCompleted: mainGuest?.isCompleted ?? false,
            mainGuestName: mainGuest ? `${mainGuest.name} ${mainGuest.lastname}`.trim() : undefined,
            reservation: {} as CheckinReservationV4,
            guestToken,
        }
    },

    /**
     * Igual que `getSecondaryGateStatus`, pero sin lanzar: clasifica el fallo en
     * vez de propagarlo, para que la página pueda decidir con un `if` plano y
     * sin envolver su JSX en un `try/catch` (ver `SecondaryGateResult`).
     *
     * No decide la política de acceso — si el titular debe haber completado o no
     * es cosa de cada página: la pantalla del gate justamente existe para
     * mostrarle al acompañante que está esperando al titular, mientras que los
     * pasos del flujo sí lo exigen.
     */
    async resolveSecondaryGate(
        reservationUuid: string,
        guestToken: string,
    ): Promise<SecondaryGateResult> {
        let status: SecondaryGateStatus
        try {
            status = await this.getSecondaryGateStatus(reservationUuid, guestToken)
        } catch {
            return { kind: "unavailable" }
        }
        if (status.portalStatus) {
            return { kind: "portal_closed", portalStatus: status.portalStatus, message: status.portalMessage }
        }
        return { kind: "ready", status }
    },
}
