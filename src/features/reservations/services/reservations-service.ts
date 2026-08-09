import { apiClient } from "@/lib/api-client"
import { API_BASE, CONFIG } from "@/lib/config"
import { normalizeLocale, type CommunicationLocale } from "@/lib/locales"
import { parseCalendarDate } from "@/lib/calendar-date"
import { composeGuestName } from "../lib/guest-name"
import { Reservation } from "@/types"
import { differenceInDays } from "date-fns"
import { listingsService } from "@/features/properties/services/listings-service"
import { propertiesService } from "@/features/properties/services/properties-service"
import { automationService, canonicalSlug } from "@/features/properties/services/automation-service"
import type { AutomationStatusItem } from "@/features/properties/types/automation"
import type { AutomationStatus } from "@/types"

type TrafficLightState = "success" | "pending" | "none"

/**
 * HitGuest-internal reservation statuses (catalog_category_id 7), keyed by catalog id.
 * These are NOT PMS statuses — they drive HitGuest's own processes: only 27 (Confirmada)
 * and 28 (En Progreso) enable the reservation's automations.
 * The catalog's `name` is a translations JSON ({"en":…,"es":…}), so we key off the
 * stable numeric id and only fall back to the name when the id is missing.
 */
const RESERVATION_STATUS_BY_ID: Record<number, Reservation["status"]> = {
    27: "CONFIRMED",
    28: "IN_PROGRESS",
    29: "CANCELLED",
    30: "CLOSED",
    108: "DELETED",
    109: "UNKNOWN",
}

/** Reads the English name out of the catalog's translations JSON (string or object). */
function statusNameEn(name: unknown): string {
    if (!name) return ""
    if (typeof name === "object") return String((name as any).en ?? (name as any).es ?? "")
    if (typeof name === "string") {
        try {
            const parsed = JSON.parse(name)
            return String(parsed?.en ?? parsed?.es ?? name)
        } catch {
            return name
        }
    }
    return ""
}

/** Maps a raw reservation to its HitGuest status — by catalog id, name as fallback. */
function mapReservationStatus(r: any): Reservation["status"] {
    const id = Number(
        r?.statusReservation?.id ?? r?.statusReservationId ?? r?.status_reservation_id
    )
    if (Number.isFinite(id) && RESERVATION_STATUS_BY_ID[id]) return RESERVATION_STATUS_BY_ID[id]

    const name = statusNameEn(r?.statusReservation?.name).toLowerCase()
    if (name.includes("cancel")) return "CANCELLED"
    if (name.includes("progress") || name.includes("progreso")) return "IN_PROGRESS"
    if (name.includes("closed") || name.includes("finalizada")) return "CLOSED"
    if (name.includes("deleted") || name.includes("eliminada")) return "DELETED"
    if (name.includes("unknow") || name.includes("desconocido")) return "UNKNOWN"
    if (name.includes("confirm")) return "CONFIRMED"
    return "UNKNOWN"
}

/** Maps a providerSlug from the automation-status API to a traffic light key.
 *  SIRE is intentionally NOT here — both SIRE automations share the slug
 *  `sire_colombia`, so they're split into sireIn/sireOut by name (see sireKind). */
const SLUG_TO_KEY: Record<string, keyof AutomationStatus> = {
    tufirma: "contract",
    // The native signature provider signs the same contract as TuFirma. It was
    // missing here, so a reservation signed with it left the CONTRATO column on
    // "—" forever: the slug matched nothing and, unlike check-in, there was no
    // name-based fallback to catch it.
    hitguest_signature: "contract",
    ttlock: "code",
    tra_colombia: "tra",
}

function liveStatusToLight(s: string): TrafficLightState {
    if (s === "completed") return "success"
    if (s === "pending" || s === "failed") return "pending"
    return "none"
}

/** Matches the Identity Verification automations (orders 1 & 2) by name. */
const CHECKIN_NAME_RE = /identity|verificaci[oó]n|check-?in/i

/**
 * Last-resort match for the signature automation by name, so a signature
 * provider we don't have in SLUG_TO_KEY yet still lights the CONTRATO column
 * instead of silently reading as "not configured". Same defensive shape as
 * CHECKIN_NAME_RE, and evaluated AFTER it so it can't steal a check-in row.
 */
const CONTRACT_NAME_RE = /firma|contrato|signature/i

/** SIRE check-out (order 8) vs check-in (order 7), told apart by the name. */
function sireKind(name: string): "sireIn" | "sireOut" {
    return /out|check-?out|salida/i.test(name) ? "sireOut" : "sireIn"
}

/** Exported for testing: pure mapping from live automation rows to the table's lights. */
export function buildTrafficLight(items: AutomationStatusItem[], checkinCompleted: boolean): AutomationStatus {
    const base: AutomationStatus = {
        link: "none",
        checkin: "none",
        contract: "none",
        code: "none",
        tra: "none",
        sireIn: "none",
        sireOut: "none",
    }

    // Collect the check-in (Identity Verification) automations so the light can
    // reflect "in progress" — not just the final completed state.
    const checkinStates: TrafficLightState[] = []

    for (const item of items) {
        const slug = canonicalSlug(item.providerSlug)
        if (slug === "sire_colombia") {
            // Both SIRE automations share this slug; split by name into in/out.
            base[sireKind(item.automationName || "")] = liveStatusToLight(item.status)
            continue
        }
        const key = SLUG_TO_KEY[slug]
        if (key) {
            base[key] = liveStatusToLight(item.status)
        } else if (CHECKIN_NAME_RE.test(item.automationName || "")) {
            checkinStates.push(liveStatusToLight(item.status))
        } else if (CONTRACT_NAME_RE.test(item.automationName || "")) {
            base.contract = liveStatusToLight(item.status)
        } else {
            // A row that matches no key and no name regex lights NOTHING — the
            // column silently reads as "not configured". That is how the CONTRATO
            // dash survived unnoticed, so make the leftovers visible instead.
            console.warn(
                "[reservations] Automatización sin columna asignada; su estado no se muestra en la tabla.",
                { slug: item.providerSlug, nombre: item.automationName, estado: item.status },
            )
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
    verificationStatus: ReservationGuestVerificationStatus
    /** ISO timestamp supplied by the backend verification record, when available. */
    verifiedAt?: string | null
}

export type ReservationGuestVerificationStatus =
    | "not_started"
    | "pending"
    | "in_progress"
    | "in_review"
    | "approved"
    | "rejected"
    | "fail"
    | "expired"
    | "completed"
    | "verified"

function normalizeGuestVerificationStatus(
    value: unknown,
    isCheckinCompleted: boolean,
    verifiedAt?: unknown,
): ReservationGuestVerificationStatus {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
    const knownStatuses: ReservationGuestVerificationStatus[] = [
        "not_started",
        "pending",
        "in_progress",
        "in_review",
        "approved",
        "rejected",
        "fail",
        "expired",
        "completed",
        "verified",
    ]

    if (knownStatuses.includes(normalized as ReservationGuestVerificationStatus)) {
        return normalized as ReservationGuestVerificationStatus
    }

    // A completed check-in necessarily passed the identity gate, but identity
    // approval by itself must not be promoted to check-in completion.
    if (isCheckinCompleted) return "completed"
    if (typeof verifiedAt === "string" && verifiedAt.trim()) return "approved"
    return "not_started"
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
    /** Reservation currency (e.g. "COP", "USD"). Never assume COP — the listing sets it. */
    currency: string
    /** Total guest count — the only guest variable the product manages (no adult/child split). */
    totalGuests: number
    externalId: string
    /** Property's default communication language (from listing.communicationsLocale). */
    communicationsLocale?: CommunicationLocale
    automationStatus: {
        link: "success" | "pending" | "none"
        checkin: "success" | "pending" | "none"
        contract: "success" | "pending" | "none"
        code: "success" | "pending" | "none"
        tra: "success" | "pending" | "none"
        sireIn: "success" | "pending" | "none"
        sireOut: "success" | "pending" | "none"
    }
}

/**
 * Surfaces the day `GET /reservations` starts paginating.
 *
 * The endpoint is contracted to return every reservation the token owns (no
 * `page`/`per_page` filters, no `meta` envelope). We deliberately do NOT crawl
 * pages here — that would mean inventing query params the API doesn't document.
 * We only detect the envelope and shout, because the failure mode is invisible:
 * consumers would just see fewer reservations and read the gap as "no activity".
 */
interface ListingLookupEntry {
    propertyId: string
    propertyName: string
    unitName: string
}

/**
 * Resolves listingUuid → {propertyId, propertyName, unitName} for the whole
 * account, once per `fetchList()` call.
 *
 * `GET /reservations` does NOT reliably nest a usable property inside its
 * `listing` field (confirmed by getById()'s own workaround, and by
 * listingsService.listByProperty()'s comment about the flat
 * `/listings?property_uuid=` query having leaked listings across properties
 * in the past — Ricardo, jul 2026). The only route documented as
 * account-scoped and correct is the nested `/properties/{uuid}/listings`, so
 * that's what this builds the map from, instead of trusting anything on the
 * raw reservation shape.
 */
export interface ListingLookupResult {
    map: Map<string, ListingLookupEntry>
    /** Propiedades cuyos alojamientos no se pudieron cargar. */
    failedProperties: string[]
}

export async function buildListingLookup(): Promise<ListingLookupResult> {
    const map = new Map<string, ListingLookupEntry>()
    const failedProperties: string[] = []

    let properties: Awaited<ReturnType<typeof propertiesService.list>>
    try {
        properties = await propertiesService.list()
    } catch (error) {
        console.error("[ReservationsService] No se pudo listar propiedades:", error)
        return { map, failedProperties }
    }

    // `Promise.allSettled`, no `Promise.all`: con `all`, un solo 503 en una
    // propiedad rechazaba de inmediato y el mapa se devolvía a medio construir
    // —las propiedades que aún no habían resuelto no llegaban a agregarse—, así
    // que una petición caída dejaba sin alojamiento a reservas de propiedades
    // que habían respondido perfectamente. Ahora cada propiedad cae sola.
    const results = await Promise.allSettled(
        properties.map(async (property) => {
            const listings = await listingsService.listByProperty(property.uuid)
            return { property, listings }
        }),
    )

    for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === "rejected") {
            failedProperties.push(properties[i]?.name || properties[i]?.uuid || "desconocida")
            continue
        }
        const { property, listings } = result.value
        for (const listing of listings) {
            if (!listing?.uuid) continue
            map.set(listing.uuid, {
                propertyId: property.uuid,
                propertyName: property.name,
                unitName: listing.internalName || listing.internal_name
                    ? `${listing.name ?? "Alojamiento"} (${listing.internalName ?? listing.internal_name})`
                    : listing.name || "Alojamiento",
            })
        }
    }

    if (failedProperties.length > 0) {
        console.error(
            `[ReservationsService] No se pudieron cargar los alojamientos de ${failedProperties.length} ` +
            `propiedad(es): ${failedProperties.join(", ")}. Sus reservas se mostrarán sin propiedad.`,
        )
    }

    return { map, failedProperties }
}

/**
 * Lee un conteo no negativo de un campo de la API, o `undefined` si no vino.
 *
 * `undefined` y `0` NO son lo mismo aquí: la columna CHECK-IN muestra "0 de 3
 * verificados" solo cuando el backend afirma que van cero, y vuelve a su
 * etiqueta binaria cuando simplemente no reportó el dato. Un `Number(x) || 0`
 * habría colapsado los dos casos y afirmado que no ha llegado nadie.
 */
function readCount(raw: unknown): number | undefined {
    if (raw === null || raw === undefined || raw === "") return undefined
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : undefined
}

function warnIfPaginated(response: unknown): void {
    const meta = (response as { meta?: Record<string, unknown> } | null)?.meta
    if (!meta) return

    const lastPage = Number(meta.last_page ?? meta.lastPage ?? 0)
    if (lastPage > 1) {
        console.error(
            `[reservations] GET /reservations devolvió ${lastPage} páginas y solo se está leyendo la primera ` +
                `(${meta.per_page ?? meta.perPage ?? "?"} de ${meta.total ?? "?"} reservas). ` +
                `El contrato no define paginación para este endpoint — confirmar con backend antes de ` +
                `confiar en el historial de consumo del Tablero.`,
        )
    }
}

export class ReservationsService {
    async getById(uuid: string): Promise<ReservationDetailData> {
        const url = `${API_BASE}/reservations/${uuid}`
        const r: any = await apiClient.get(url)

        const checkIn = parseCalendarDate(r.arrivalDate || r.arrival_date)
        const checkOut = parseCalendarDate(r.departureDate || r.departure_date)

        const guestName = composeGuestName(r.extra)
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

        const status = mapReservationStatus(r)

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
            currency: r.currency || r.currency_code || "COP",
            totalGuests: Number(r.totalGuests || r.total_guests || 1),
            externalId: r.externalId || r.external_id || "",
            communicationsLocale: normalizeLocale(listing?.communicationsLocale || listing?.communications_locale),
            automationStatus: {
                link: r.listing ? "success" : "pending",
                checkin: r.isCheckinCompleted ? "success" : "pending",
                contract: "none",
                code: "none",
                tra: "none",
                sireIn: "none",
                sireOut: "none",
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

    /**
     * Sends (or resends) the guest the check-in link email.
     * - `locale` (optional): when omitted the backend uses the property's default
     *   communication language (extra.communicationsLocale).
     * - `email` (optional): when omitted the backend uses the reservation's main
     *   guest email; pass it to override the recipient for this send.
     * Resolves to the backend's `message`; throws on 422 (invalid state / no email).
     */
    async sendCheckinLink(
        uuid: string,
        opts?: { locale?: CommunicationLocale; email?: string }
    ): Promise<string> {
        const url = `${API_BASE}/reservations/${uuid}/send-checkin-link`
        const body: Record<string, string> = {}
        if (opts?.locale) body.locale = opts.locale
        if (opts?.email) body.email = opts.email
        // suppressUnauthorizedRedirect: a failed resend (e.g. backend policy/guard
        // returning 401) must NOT clear the PM's session and bounce them to /login.
        // Surface it as an error toast instead.
        const r: any = await apiClient.post(url, body, { suppressUnauthorizedRedirect: true })
        return r?.message || r?.data?.message || "Link de check-in enviado"
    }

    async getGuests(reservationUuid: string): Promise<ReservationGuest[]> {
        // ── First try the checkin portal (authoritative for verification status) ──
        try {
            const url = `${API_BASE}/checkin/${reservationUuid}`
            const headers: Record<string, string> = {
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
            const response = await fetch(url, { headers, cache: "no-store" })
            if (response.ok) {
                const json: any = await response.json()
                const portal = json.data || json
                const guests = Array.isArray(portal.registeredGuests)
                    ? portal.registeredGuests
                    : (portal.registered_guests ?? [])
                if (guests.length > 0) {
                    // The portal is authoritative for verification status but does NOT
                    // include document images. Fetch them from /guests and merge by uuid.
                    const imageMap = await this.fetchGuestImageMap(reservationUuid)
                    return guests.map((g: any): ReservationGuest => {
                        const isCompleted = g.isCompleted ?? g.is_completed ?? false
                        const uuid = g.uuid || g.id
                        const images = imageMap.get(uuid)
                        const verifiedAt =
                            g.verification?.verifiedAt
                            ?? g.verification?.verified_at
                            ?? null
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
                            verificationStatus: normalizeGuestVerificationStatus(
                                g.verification?.status
                                ?? g.verificationStatus
                                ?? g.verification_status,
                                isCompleted,
                                verifiedAt,
                            ),
                            verifiedAt,
                        }
                    })
                }
            } else {
                console.warn(`[GuestDocuments] Portal returned HTTP ${response.status}`)
            }
        } catch (error) {
            console.warn("[ReservationsService] Portal fetch failed, falling back to reservation guests endpoint:", error)
        }
        // ── Fallback: reservation guests endpoint (may have local document images) ──
        const url = `${API_BASE}/reservations/${reservationUuid}/guests`
        try {
            const raw: any = await apiClient.get(url)
            const guests = Array.isArray(raw) ? raw : (raw?.data ?? [])

            return guests.map((g: any): ReservationGuest => {
                // pivot = guest_reservation relationship data
                const pivot = g.pivot || {}
                const pivotExtra = pivot.extra || {}
                // v4.6: guest data nested under guestProfile. Images MUST come from
                // reservationSpecificData.documentImages (resolved, authenticated URLs
                // via reservations.identity-documents.show) — NOT guestProfile.extra,
                // which holds a raw internal storage path that isn't servable.
                const profile = g.guestProfile || g.guest_profile || {}
                const profileExtra = profile.extra || {}
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
                    g.isCompleted ??               // v4.6: top-level on the guest entry
                    g.is_completed ??
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
                const verificationStatus = normalizeGuestVerificationStatus(
                    rawVerificationStatus,
                    isCompleted,
                    g.verification?.verifiedAt ?? g.verification?.verified_at,
                )

                return {
                    uuid: profile.uuid || g.uuid || g.id,
                    name: profile.name || g.name || "",
                    lastname: profile.lastname || g.lastname || g.last_name || "",
                    identificationNumber: profile.identificationNumber || profileExtra.identificationNumber
                        || g.identificationNumber || g.identification_number
                        || g.identificationType?.pivot?.value || g.identification_type?.pivot?.value,
                    identificationType: g.identificationType?.name || g.identification_type?.name || g.identificationTypeName,
                    isMain: g.isMainGuest ?? g.is_main_guest ?? pivot.is_main_guest ?? pivot.isMainGuest ?? g.isMain ?? g.is_main ?? false,
                    isCheckinCompleted: isCompleted,
                    documentImage1: resolveImageUrl(frontPath),
                    documentImage2: resolveImageUrl(backPath),
                    verificationStatus,
                    verifiedAt:
                        g.verification?.verifiedAt
                        ?? g.verification?.verified_at
                        ?? null,
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
                // v4.6: the guest is nested under guestProfile (uuid lives there).
                const profile = g.guestProfile || g.guest_profile || {}
                const uuid = profile.uuid || g.uuid || g.id
                if (!uuid) continue
                const pivotExtra = g.pivot?.extra || {}
                // Reservation context: use ONLY reservationSpecificData.documentImages
                // (resolved, authenticated URLs). guestProfile.extra.documentImages is a
                // raw internal storage path — not usable and leaks internal paths.
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

    /** In-flight `list()` promise, shared to dedupe concurrent callers. */
    private listInFlight: Promise<Reservation[]> | null = null

    /**
     * Lists reservations (with per-reservation automation status merged in).
     *
     * Concurrent callers on the same page (e.g. StatsCards + ReservationsList)
     * share a single in-flight request so the reservations fetch and the N
     * per-reservation automation-status fetches run once. This is deduping, NOT
     * caching: the shared promise is cleared as soon as it settles, so every
     * later call (manual refresh, after create/delete) fetches fresh data.
     */
    async list(): Promise<Reservation[]> {
        if (this.listInFlight) return this.listInFlight
        this.listInFlight = this.fetchList().finally(() => { this.listInFlight = null })
        return this.listInFlight
    }

    private async fetchList(): Promise<Reservation[]> {
        const url = `${API_BASE}/reservations`

        try {
            // Independent requests — run together instead of one blocking the other.
            const [response, lookupResult] = await Promise.all([
                apiClient.get<any>(url),
                buildListingLookup(),
            ])
            const { map: listingLookup, failedProperties } = lookupResult

            // Extract array from standard { success: true, data: [...] } structure
            const dataArray = response?.data && Array.isArray(response.data)
                ? response.data
                : (Array.isArray(response) ? response : [])

            // Per the contract, GET /reservations returns the full list — it has no
            // `page`/`per_page` filters and no pagination envelope, unlike /users or
            // /billing/transactions. If that ever changes we'd silently keep page 1,
            // and the Tablero's consumption history would under-report old months as
            // real zeros. Fail loudly instead of quietly lying.
            warnIfPaginated(response)

            // Only fires once per fetchList() call (not once per unmatched reservation)
            // — this is a config/contract signal, not per-row spam.
            let unmatchedListings = 0

            const reservations = dataArray.map((r: any): Reservation => {
                const checkIn = parseCalendarDate(r.arrivalDate || r.arrival_date)
                const checkOut = parseCalendarDate(r.departureDate || r.departure_date)
                
                // ── Guest name: `extra` guarda nombre y apellido por separado;
                // las reservas antiguas traen el nombre entero en guest_name ──
                const guestName = composeGuestName(r.extra)
                    || r.mainGuest?.name
                    || r.emailGuest?.split("@")[0]
                    || "Huésped"

                // ── Source: API returns { source: { id, name, slug } } ──
                let sourceName: "Airbnb" | "Booking" | "Direct" = "Direct"
                const srcSlug = r.source?.slug || r.source?.name || ""
                if (srcSlug.toLowerCase().includes("airbnb")) sourceName = "Airbnb"
                else if (srcSlug.toLowerCase().includes("booking")) sourceName = "Booking"

                // ── Listing / Property ──
                // GET /reservations does not reliably nest a usable property inside
                // `listing` (see buildListingLookup()'s JSDoc) — so resolve via the
                // account-wide listing→property map built from the documented-correct
                // nested route, not from assuming one shape of the raw reservation.
                // Try every documented candidate for the listing's own UUID, since the
                // exact field name here isn't confirmed by any single doc in this repo.
                const listing = r.listing || {}
                const listingUuid: string | undefined =
                    listing?.uuid || r.listingUuid || r.listing_uuid || undefined
                const resolved = listingUuid ? listingLookup.get(listingUuid) : undefined

                if (!resolved) unmatchedListings++

                const propertyName = resolved?.propertyName
                    || listing?.property?.name
                    || listing?.name
                    || "Propiedad Desconocida"
                const propertyId = resolved?.propertyId
                    || listing?.property?.uuid
                    || listing?.propertyUuid
                    || listing?.property_uuid
                    || ""
                const unitName = resolved?.unitName || listing?.name || "Alojamiento"
                const unitId = listingUuid || r.listingId?.toString() || r.listing_id?.toString() || ""

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
                    totalGuests: readCount(r.totalGuests ?? r.total_guests),
                    // Conteo de huéspedes con el check-in completo. Se leen las
                    // claves plausibles porque NINGUNA está confirmada contra un
                    // payload real de GET /reservations — ver readCount().
                    completedGuests: readCount(
                        r.completedGuests
                        ?? r.completed_guests
                        ?? r.checkinCompletedGuests
                        ?? r.checkin_completed_guests
                        ?? r.progress?.completed,
                    ),
                }
            })

            // Dos causas MUY distintas producen el mismo síntoma, y el aviso
            // anterior siempre culpaba a la segunda: mandaba a revisar el
            // contrato del backend cuando lo único que había pasado era un 503.
            if (unmatchedListings > 0 && failedProperties.length > 0) {
                console.warn(
                    `[reservations] ${unmatchedListings}/${reservations.length} reservas sin propiedad porque no se ` +
                        `pudieron cargar los alojamientos de: ${failedProperties.join(", ")}. Es un fallo de red o del ` +
                        `backend, NO un problema del contrato — reintentar antes de investigar los nombres de campo.`,
                )
            } else if (unmatchedListings > 0 && listingLookup.size > 0) {
                console.error(
                    `[reservations] ${unmatchedListings}/${reservations.length} reservas no pudieron unirse al mapa ` +
                        `de propiedades/alojamientos — ninguna de las claves candidatas (listing.uuid, listingUuid, ` +
                        `listing_uuid) coincidió con un listing conocido. El filtro de "Propiedades"/"Alojamientos" ` +
                        `en el calendario de Operaciones mostrará "Propiedad Desconocida"/"Alojamiento" para esas ` +
                        `reservas — confirmar con backend el campo real que identifica el listing en GET /reservations.`,
                )
            }

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
