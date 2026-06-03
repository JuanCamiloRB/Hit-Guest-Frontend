import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { Reservation } from "@/types"
import { differenceInDays } from "date-fns"

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
            propertyName: property?.name || listing?.name || "Propiedad",
            unitName: listing?.name || "Alojamiento",
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

    async list(): Promise<Reservation[]> {
        const url = `${API_BASE}/reservations`

        try {
            const response = await apiClient.get<any>(url)
            
            // Extract array from standard { success: true, data: [...] } structure
            const dataArray = response?.data && Array.isArray(response.data) 
                ? response.data 
                : (Array.isArray(response) ? response : [])

            return dataArray.map((r: any): Reservation => {
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
                    automationStatus: {
                        link: r.listing ? "success" : "pending",
                        checkin: r.isCheckinCompleted ? "success" : "pending",
                        contract: "none",
                        code: "none",
                        tra: "none",
                        sire: "none",
                    }
                }
            })
        } catch (error) {
            console.error("[ReservationsService] Error listing reservations:", error)
            throw error
        }
    }
}

export const reservationsService = new ReservationsService()
