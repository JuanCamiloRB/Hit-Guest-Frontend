import { apiClient } from "@/lib/api-client"
import { API_BASE, CONFIG } from "@/lib/config"
import { Reservation } from "@/types"
import { differenceInDays } from "date-fns"
import { listingsService } from "@/features/properties/services/listings-service"
import { propertiesService } from "@/features/properties/services/properties-service"
import { automationService } from "@/features/properties/services/automation-service"
import type { AutomationStatusItem } from "@/features/properties/types/automation"
import type { AutomationStatus } from "@/types"

type TrafficLightState = "success" | "pending" | "none"

/** Maps a providerSlug from the automation-status API to a traffic light key. */
const SLUG_TO_KEY: Record<string, keyof AutomationStatus> = {
    tufirma: "contract",
    ttlock: "code",
    tra_colombia: "tra",
    sire_colombia: "sire",
}

function liveStatusToLight(s: string): TrafficLightState {
    if (s === "completed") return "success"
    if (s === "pending" || s === "failed") return "pending"
    return "none"
}

/** Matches the Identity Verification automations (orders 1 & 2) by name. */
const CHECKIN_NAME_RE = /identity|verificaci[oó]n|check-?in/i

function buildTrafficLight(items: AutomationStatusItem[], checkinCompleted: boolean): AutomationStatus {
    const base: AutomationStatus = {
        link: "none",
        checkin: "none",
        contract: "none",
        code: "none",
        tra: "none",
        sire: "none",
    }

    // Collect the check-in (Identity Verification) automations so the light can
    // reflect "in progress" — not just the final completed state.
    const checkinStates: TrafficLightState[] = []

    for (const item of items) {
        const key = SLUG_TO_KEY[item.providerSlug]
        if (key) {
            base[key] = liveStatusToLight(item.status)
        } else if (CHECKIN_NAME_RE.test(item.automationName || "")) {
            checkinStates.push(liveStatusToLight(item.status))
        }
    }

    // Check-in light: success only when every identity automation completed;
    // pending if any has started; none if none has started yet.
    if (checkinStates.length > 0) {
        const allSuccess = checkinStates.every(s => s === "success")
        const anyStarted = checkinStates.some(s => s !== "none")
        base.checkin = allSuccess ? "success" : anyStarted ? "pending" : "none"
    }

    // The reservation's own completion flag always wins as success.
    if (checkinCompleted) base.checkin = "success"

    // If any automation ran, the link was sent
    if (items.length > 0) base.link = "success"
    return base
}

export interface ReservationGuest {
    uuid: string
    name: string
    lastname: string
    identificationNumber?: string
    identificationType?: string
    isMain: boolean
    isCheckinCompleted: boolean
    documentImage1?: string | null
    documentImage2?: string | null
    verificationStatus?: string
}

export interface ReservationDetailData {
    uuid: string
    guestName: string
    email?: string
    phone?: string
    propertyName: string
    unitName: string
    checkIn: Date
    checkOut: Date
    nights: number
    status: Reservation["status"]
    source: "Airbnb" | "Booking" | "Direct"
    totalPrice: number
    externalId: string
    automationStatus: {
        link: "success" | "pending" | "none"
        checkin: "success" | "pending" | "none"
        contract: "success" | "pending" | "none"
        code: "success" | "pending" | "none"
        tra: "success" | "pending" | "none"
        sire: "success" | "pending" | "none"
    }
}

export class ReservationsService {
    async getById(uuid: string): Promise<ReservationDetailData> {
        const url = `${API_BASE}/reservations/${uuid}`
        const r: any = await apiClient.get(url)

        const checkIn = new Date(r.arrivalDate || r.arrival_date)
        const checkOut = new Date(r.departureDate || r.departure_date)

        const guestName = r.extra?.guestName
            || r.extra?.guest_name
            || r.mainGuest?.name
            || r.emailGuest?.split("@")[0]
            || "Huésped"

        let sourceName: "Airbnb" | "Booking" | "Direct" = "Direct"
        const srcSlug = r.source?.slug || r.source?.name || ""
        if (srcSlug.toLowerCase().includes("airbnb")) sourceName = "Airbnb"
        else if (srcSlug.toLowerCase().includes("booking")) sourceName = "Booking"

        const listing = r.listing || {}
        const property = listing?.property || {}

        // The reservation API doesn't nest property inside listing — resolve it
        // via the listing detail so the card doesn't show the unit name twice.
        let propertyName: string = property?.name || ""
        if (!propertyName && listing?.uuid) {
            try {
                const fullListing = await listingsService.getById(listing.uuid)
                propertyName = fullListing?.property?.name || ""
                if (!propertyName) {
                    const propUuid = fullListing?.propertyUuid || fullListing?.property_uuid
                    if (propUuid) {
                        const prop: any = await propertiesService.getByUuid(propUuid)
                        propertyName = prop?.name || (prop as any)?.data?.name || ""
                    }
                }
            } catch {
                // Non-critical — fall back below
            }
        }

        let status: Reservation["status"] = "CONFIRMED"
        const statusSlug = r.statusReservation?.name?.toLowerCase() || ""
        if (statusSlug.includes("cancelada") || statusSlug.includes("cancel")) status = "CANCELLED"
        else if (statusSlug.includes("pendiente") || statusSlug.includes("pending")) status = "PENDING"
        else if (statusSlug.includes("check-in") || statusSlug.includes("checkin")) status = "CHECKED_IN"

        return {
            uuid: r.uuid || uuid,
            guestName,
            email: r.emailGuest || r.email_guest,
            phone: r.extra?.guestPhone || r.extra?.guest_phone,
            propertyName: propertyName || listing?.name || "Propiedad",
            unitName: listing?.internalName || listing?.internal_name
                ? `${listing?.name ?? "Alojamiento"} (${listing.internalName ?? listing.internal_name})`
                : listing?.name || "Alojamiento",
            checkIn,
            checkOut,
            nights: differenceInDays(checkOut, checkIn) || 1,
            status,
            source: sourceName,
            totalPrice: Number(r.totalPrice || r.total_price || 0),
            externalId: r.externalId || r.external_id || "",
            automationStatus: {
                link: r.listing ? "success" : "pending",
                checkin: r.isCheckinCompleted ? "success" : "pending",
                contract: "none",
                code: "none",
                tra: "none",
                sire: "none",
            }
        }
    }

    async getRawById(uuid: string): Promise<any> {
        const url = `${API_BASE}/reservations/${uuid}`
        return await apiClient.get(url)
    }

    async update(uuid: string, payload: any): Promise<any> {
        const url = `${API_BASE}/reservations/${uuid}`
        return await apiClient.put(url, payload)
    }

    async delete(uuid: string): Promise<void> {
        const url = `${API_BASE}/reservations/${uuid}`
        await apiClient.delete<void>(url)
    }

    async getGuests(reservationUuid: string): Promise<ReservationGuest[]> {
        // ── First try the checkin portal (authoritative for verification status) ──
        try {
            const url = `${API_BASE}/checkin/${reservationUuid}`
            const headers: Record<string, string> = {
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
            if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
            const response = await fetch(url, { headers, cache: "no-store" })
            if (response.ok) {
                const json: any = await response.json()
                console.log("[GuestDocuments] Portal raw response:", JSON.stringify(json).slice(0, 800))
                const portal = json.data || json
                const guests = Array.isArray(portal.registeredGuests)
                    ? portal.registeredGuests
                    : (portal.registered_guests ?? [])
                console.log("[GuestDocuments] registeredGuests:", guests)
                if (guests.length > 0) {
                    // The portal is authoritative for verification status but does NOT
                    // include document images. Fetch them from /guests and merge by uuid.
                    const imageMap = await this.fetchGuestImageMap(reservationUuid)
                    return guests.map((g: any): ReservationGuest => {
                        const isCompleted = g.isCompleted ?? g.is_completed ?? false
                        const uuid = g.uuid || g.id
                        const images = imageMap.get(uuid)
                        return {
                            uuid,
                            name: g.name || "",
                            lastname: g.lastname || g.last_name || "",
                            identificationNumber: g.identificationNumber || g.identification_number || "",
                            identificationType: g.identificationType || g.identification_type || "",
                            isMain: g.isMain ?? g.is_main ?? false,
                            isCheckinCompleted: isCompleted,
                            documentImage1: g.documentImage1 || g.document_image_1 || images?.image1 || null,
                            documentImage2: g.documentImage2 || g.document_image_2 || images?.image2 || null,
                            verificationStatus: isCompleted ? "verified" : "pending",
                        }
                    })
                }
            } else {
                const errBody = await response.json().catch(() => ({}))
                console.warn(`[GuestDocuments] Portal returned ${response.status}:`, JSON.stringify(errBody), "| UUID:", reservationUuid)
            }
        } catch (error) {
            console.warn("[ReservationsService] Portal fetch failed, falling back to reservation guests endpoint:", error)
        }
        console.log("[GuestDocuments] Portal had 0 guests or failed — falling back to /reservations/{uuid}/guests")

        // ── Fallback: reservation guests endpoint (may have local document images) ──
        const url = `${API_BASE}/reservations/${reservationUuid}/guests`
        try {
            const raw: any = await apiClient.get(url)
            console.log("[GuestDocuments] Fallback raw:", JSON.stringify(raw).slice(0, 800))
            const guests = Array.isArray(raw) ? raw : (raw?.data ?? [])

            return guests.map((g: any): ReservationGuest => {
                console.log("[GuestDocuments] Fallback guest raw:", JSON.stringify(g).slice(0, 600))
                // pivot = guest_reservation relationship data
                const pivot = g.pivot || {}
                const pivotExtra = pivot.extra || {}
                // v4.5: backend now returns full HTTP URLs under
                // reservationSpecificData.documentImages. Older versions used
                // relative storage paths under pivot.extra.document_images.
                const reservationSpecific = g.reservationSpecificData || g.reservation_specific_data || {}
                const docImages =
                    reservationSpecific.documentImages
                    || reservationSpecific.document_images
                    || pivotExtra.document_images
                    || pivotExtra.documentImages
                    || {}

                // Legacy paths are relative to /storage/; new values are absolute URLs.
                const storageBase = CONFIG.API_URL_GUEST.replace(/\/api\/v1\/?$/, "") + "/storage/"
                const resolveImageUrl = (path: string | null): string | null => {
                    if (!path) return null
                    return /^https?:\/\//i.test(path) ? path : `${storageBase}${path}`
                }
                const frontPath = docImages.front || null
                const backPath = docImages.back || null

                // Check every possible location the backend may put this flag
                const isCompleted =
                    pivot.is_checkin_completed ??
                    pivot.isCheckinCompleted ??
                    g.isCheckinCompleted ??
                    g.is_checkin_completed ??
                    // Some backends return it nested under the guest directly
                    g.checkinCompleted ??
                    g.checkin_completed ??
                    false

                // Verification status: explicit field wins; completed guest always = "verified"
                const rawVerificationStatus = g.verification?.status
                    || g.verificationStatus
                    || g.verification_status
                    || pivot.verification_status
                    || pivot.verificationStatus
                const verificationStatus = rawVerificationStatus || (isCompleted ? "verified" : "pending")

                console.log(`[GuestDocuments] ${g.name} ${g.lastname}: isCompleted=${isCompleted}, pivot=`, JSON.stringify(pivot).slice(0, 300))

                return {
                    uuid: g.uuid || g.id,
                    name: g.name || "",
                    lastname: g.lastname || g.last_name || "",
                    identificationNumber: g.identificationNumber || g.identification_number
                        || g.identificationType?.pivot?.value || g.identification_type?.pivot?.value,
                    identificationType: g.identificationType?.name || g.identification_type?.name || g.identificationTypeName,
                    isMain: pivot.is_main_guest ?? pivot.isMainGuest ?? g.isMain ?? g.is_main ?? false,
                    isCheckinCompleted: isCompleted,
                    documentImage1: resolveImageUrl(frontPath),
                    documentImage2: resolveImageUrl(backPath),
                    verificationStatus,
                }
            })
        } catch (error) {
            console.error("[ReservationsService] Error fetching guests:", error)
            return []
        }
    }

    /**
     * Fetches GET /reservations/{uuid}/guests and returns a map of
     * guestUuid → document image URLs. Used to enrich the portal response,
     * which is authoritative for verification status but omits images.
     * v4.5: images come as full HTTP URLs under reservationSpecificData.documentImages.
     */
    private async fetchGuestImageMap(
        reservationUuid: string,
    ): Promise<Map<string, { image1: string | null; image2: string | null }>> {
        const map = new Map<string, { image1: string | null; image2: string | null }>()
        try {
            const url = `${API_BASE}/reservations/${reservationUuid}/guests`
            const raw: any = await apiClient.get(url)
            const guests = Array.isArray(raw) ? raw : (raw?.data ?? [])
            const storageBase = CONFIG.API_URL_GUEST.replace(/\/api\/v1\/?$/, "") + "/storage/"
            const resolveImageUrl = (path: string | null): string | null => {
                if (!path) return null
                return /^https?:\/\//i.test(path) ? path : `${storageBase}${path}`
            }
            for (const g of guests) {
                const uuid = g.uuid || g.id
                if (!uuid) continue
                const pivotExtra = g.pivot?.extra || {}
                const reservationSpecific = g.reservationSpecificData || g.reservation_specific_data || {}
                const docImages =
                    reservationSpecific.documentImages
                    || reservationSpecific.document_images
                    || pivotExtra.document_images
                    || pivotExtra.documentImages
                    || {}
                map.set(uuid, {
                    image1: resolveImageUrl(docImages.front || null),
                    image2: resolveImageUrl(docImages.back || null),
                })
            }
        } catch (error) {
            console.warn("[ReservationsService] fetchGuestImageMap failed:", error)
        }
        return map
    }

    async list(): Promise<Reservation[]> {
        const url = `${API_BASE}/reservations`

        try {
            const response = await apiClient.get<any>(url)
            
            // Extract array from standard { success: true, data: [...] } structure
            const dataArray = response?.data && Array.isArray(response.data) 
                ? response.data 
                : (Array.isArray(response) ? response : [])

            const reservations = dataArray.map((r: any): Reservation => {
                const checkIn = new Date(r.arrivalDate || r.arrival_date)
                const checkOut = new Date(r.departureDate || r.departure_date)
                
                // ── Guest name: API returns extra.guestName (camelCase) ──
                const guestName = r.extra?.guestName 
                    || r.extra?.guest_name 
                    || r.mainGuest?.name
                    || r.emailGuest?.split("@")[0]
                    || "Huésped"

                // ── Source: API returns { source: { id, name, slug } } ──
                let sourceName: "Airbnb" | "Booking" | "Direct" = "Direct"
                const srcSlug = r.source?.slug || r.source?.name || ""
                if (srcSlug.toLowerCase().includes("airbnb")) sourceName = "Airbnb"
                else if (srcSlug.toLowerCase().includes("booking")) sourceName = "Booking"

                // ── Listing / Property: API returns listing as nested object ──
                const listing = r.listing || {}
                const property = listing?.property || {}

                const propertyName = property?.name || listing?.name || "Propiedad Desconocida"
                const propertyId = property?.uuid || listing?.propertyUuid || listing?.property_uuid || ""
                const unitName = listing?.name || "Alojamiento"
                const unitId = listing?.uuid || r.listingId?.toString() || r.listing_id?.toString() || ""

                // ── Status mapping from API statusReservation ──
                let status: Reservation["status"] = "CONFIRMED"
                const statusSlug = r.statusReservation?.name?.toLowerCase() || ""
                if (statusSlug.includes("cancelada") || statusSlug.includes("cancel")) status = "CANCELLED"
                else if (statusSlug.includes("pendiente") || statusSlug.includes("pending")) status = "PENDING"
                else if (statusSlug.includes("check-in") || statusSlug.includes("checkin")) status = "CHECKED_IN"

                return {
                    id: r.uuid || r.id?.toString(),
                    guestName,
                    email: r.emailGuest || r.email_guest,
                    phone: r.extra?.guestPhone || r.extra?.guest_phone || undefined,
                    propertyId,
                    propertyName,
                    unitId,
                    unitName,
                    checkIn,
                    checkOut,
                    nights: differenceInDays(checkOut, checkIn) || 1,
                    status,
                    source: sourceName,
                    totalPrice: Number(r.totalPrice || r.total_price || 0),
                }
            })

            // Fetch automation status for each reservation in parallel
            const statusResults = await Promise.allSettled(
                reservations.map((res: Reservation) =>
                    automationService.getReservationStatus(res.id).catch(() => [] as AutomationStatusItem[])
                )
            )
            for (let i = 0; i < reservations.length; i++) {
                const result = statusResults[i]
                const items = result.status === "fulfilled" ? result.value : []
                // Use the reservation's real check-in flag (same source as the detail view),
                // falling back to the global CHECKED_IN status for older payloads.
                const raw = dataArray[i]
                const checkinCompleted = raw?.isCheckinCompleted ?? raw?.is_checkin_completed
                    ?? (reservations[i].status === "CHECKED_IN")
                reservations[i].automationStatus = buildTrafficLight(items, checkinCompleted)
            }

            return reservations
        } catch (error) {
            console.error("[ReservationsService] Error listing reservations:", error)
            throw error
        }
    }
}

export const reservationsService = new ReservationsService()
