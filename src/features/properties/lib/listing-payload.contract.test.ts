import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }))
vi.mock("@/lib/api-client", () => ({
    apiClient: { get: vi.fn(), post: mocks.post, put: mocks.put, patch: vi.fn(), delete: vi.fn() },
    handleSessionExpired: vi.fn(),
}))

import { toListingPayload } from "./listing-payload"
import { listingsService } from "../services/listings-service"
import { DEFAULT_CANCELLATION_POLICY, DEFAULT_LISTING_THUMBNAIL_URL } from "./property-defaults"

/**
 * Fase 0 del rediseño del formulario de propiedad: el payload de
 * `POST/PUT /listings` queda CONGELADO, desde el borrador del diálogo hasta lo
 * que el servicio pone en la red (alias snake_case incluidos).
 */

const draft = {
    name: "  Suite Junior ",
    internalName: "SJ-101",
    roomTypeId: "7",
    thumbnailUrl: DEFAULT_LISTING_THUMBNAIL_URL,
    contactName: "Ana",
    contactEmail: "ana@mirador.co",
    contactPhone: "+57 300 123 4567 ext. 204",
    isActive: true,
    price: "250000",
    externalPmsIds: undefined,
    extra: {
        currency: "COP",
        picturesUrl: [],
        bedRoom: 1,
        bathRoom: 1,
        rooms: 1,
        maxOccupancy: 2,
        minNights: 1,
        maxNights: 30,
        checkIn: "15:00",
        checkOut: "11:00",
        wifiDetails: { network: "", password: "" },
        amenities: [] as number[],
        cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
        inheritAmenities: true,
        inheritWifi: true,
        inheritSchedule: true,
        inheritPolicies: true,
    },
}

describe("toListingPayload — el borrador del diálogo, congelado", () => {
    it("un alojamiento nuevo con todo heredado: la forma exacta", () => {
        expect(toListingPayload("prop-1", draft)).toEqual({
            propertyUuid: "prop-1",
            name: "Suite Junior",
            internalName: "SJ-101",
            roomTypeId: 7,
            description: undefined,
            thumbnailUrl: DEFAULT_LISTING_THUMBNAIL_URL,
            contactName: "Ana",
            contactEmail: "ana@mirador.co",
            // Texto libre, sin normalizar.
            contactPhone: "+57 300 123 4567 ext. 204",
            statusRecordId: 6,
            extra: {
                currency: "COP",
                picturesUrl: [],
                bedRoom: 1,
                bathRoom: 1,
                rooms: 1,
                maxOccupancy: 2,
                minNights: 1,
                maxNights: 30,
                startPrice: 250000,
                // Heredado: horarios, wifi, amenidades y política NO viajan.
            },
        })
    })

    it("con los interruptores apagados viajan los valores propios; la política STANDARD sin alterar", () => {
        const own = toListingPayload("prop-1", {
            ...draft,
            extra: { ...draft.extra, inheritSchedule: false, inheritWifi: false, inheritPolicies: false, inheritAmenities: false, amenities: [{ id: 46, name: "WiFi" }, 47] },
        })
        expect(own.extra).toMatchObject({
            checkIn: "15:00", checkOut: "11:00",
            wifiDetails: { network: "", password: "" },
            cancellationPolicy: "STANDARD",
            amenities: [46, 47],
        })
        for (const key of ["inheritSchedule", "inheritWifi", "inheritPolicies", "inheritAmenities"]) expect(key in own.extra).toBe(false)
    })

    it("precio: vacío → 0, «0» → 0, texto → número; la moneda se conserva; inactivo → estado 7", () => {
        expect(toListingPayload("p", { ...draft, price: "" }).extra.startPrice).toBe(0)
        expect(toListingPayload("p", { ...draft, price: "0" }).extra.startPrice).toBe(0)
        expect(toListingPayload("p", { ...draft, price: "12.5", extra: { ...draft.extra, currency: "USD" } }).extra).toMatchObject({ startPrice: 12.5, currency: "USD" })
        expect(toListingPayload("p", { ...draft, isActive: false }).statusRecordId).toBe(7)
    })

    it("externalPmsIds: omitido = no tocar; [] = borrar; filas completas con id", () => {
        expect("externalPmsIds" in toListingPayload("p", draft)).toBe(false)
        expect(toListingPayload("p", { ...draft, externalPmsIds: [] }).externalPmsIds).toEqual([])
        expect(toListingPayload("p", { ...draft, externalPmsIds: [{ id: 3, sourcePmsId: 134, externalId: " X " }] }).externalPmsIds)
            .toEqual([{ id: 3, sourcePmsId: 134, externalId: "X" }])
    })
})

describe("listingsService — lo que llega a la red (alias snake_case), congelado", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.post.mockResolvedValue({ data: { uuid: "l-1" } })
        mocks.put.mockResolvedValue({ data: { uuid: "l-1" } })
    })

    it("POST /listings duplica claves en snake_case y pone el precio en la raíz y en extra", async () => {
        await listingsService.create(toListingPayload("prop-1", draft))
        const [url, body] = mocks.post.mock.calls[0]
        expect(url).toMatch(/\/listings$/)
        expect(body).toMatchObject({
            propertyUuid: "prop-1", property_uuid: "prop-1",
            roomTypeId: 7, room_type_id: 7,
            internalName: "SJ-101", internal_name: "SJ-101",
            statusRecordId: 6, status_record_id: 6,
            contactEmail: "ana@mirador.co", contact_email: "ana@mirador.co",
            contactPhone: "+57 300 123 4567 ext. 204", contact_phone: "+57 300 123 4567 ext. 204",
            thumbnailUrl: DEFAULT_LISTING_THUMBNAIL_URL, thumbnail_url: DEFAULT_LISTING_THUMBNAIL_URL,
            price: 250000, start_price: 250000,
            extra: { startPrice: 250000, currency: "COP" },
        })
    })

    it("PUT /listings/{uuid}: el diálogo manda además price/start_price en la raíz y el servicio los conserva", async () => {
        const base = toListingPayload("prop-1", draft)
        await listingsService.update("l-1", { ...base, price: 250000, start_price: 250000 } as typeof base)
        const [url, body] = mocks.put.mock.calls[0]
        expect(url).toMatch(/\/listings\/l-1$/)
        expect(body).toMatchObject({ price: 250000, start_price: 250000, extra: { startPrice: 250000, currency: "COP" }, statusRecordId: 6 })
    })

    it("precio 0 llega como 0 en extra (no se inventa otro) y la moneda ausente cae a COP", async () => {
        await listingsService.create(toListingPayload("prop-1", { ...draft, price: "0", extra: { ...draft.extra, currency: undefined } }))
        const body = mocks.post.mock.calls[0][1]
        expect(body.extra).toMatchObject({ startPrice: 0, currency: "COP" })
    })
})
