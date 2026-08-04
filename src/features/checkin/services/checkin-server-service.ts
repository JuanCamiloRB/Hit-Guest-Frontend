import "server-only"

import type { CheckinPortalResponse, CheckinReservationV4, SecondaryGateStatus, SmartlockCode } from "../types/checkin"

const API_BASE = (
    process.env.API_URL_GUEST
    || process.env.NEXT_PUBLIC_API_URL_GUEST
    || "https://guest.hit.tools/api/v1"
).trim().replace(/\/$/, "")

// Server-only compatibility fallback. Rename the deployment variable to
// APP_API_TOKEN; the NEXT_PUBLIC name can then be removed from Vercel.
const APP_TOKEN = process.env.APP_API_TOKEN || process.env.NEXT_PUBLIC_APP_API_TOKEN || ""

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
        return normalizePortal((json?.data ?? json) as CheckinPortalResponse & Record<string, unknown>)
    },

    async getSecondaryGateStatus(reservationUuid: string, guestToken: string): Promise<SecondaryGateStatus> {
        const portal = await this.getPortal(reservationUuid)
        const mainGuest = portal.registeredGuests.find(guest => guest.isMain)
        return {
            mainGuestCompleted: mainGuest?.isCompleted ?? false,
            mainGuestName: mainGuest ? `${mainGuest.name} ${mainGuest.lastname}`.trim() : undefined,
            reservation: {} as CheckinReservationV4,
            guestToken,
        }
    },
}
