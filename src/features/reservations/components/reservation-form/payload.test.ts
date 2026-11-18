import { describe, expect, it } from "vitest"
import {
    FORM_FIELD_BY_API_KEY,
    buildReservationPayload,
    manualExternalId,
    reservationSchema,
    type ReservationFormValues,
} from "./payload"

/**
 * Fase 0 del rediseño: el payload que recibe el backend queda CONGELADO.
 * Estas pruebas describen lo que el diálogo mandaba antes de mover un campo.
 * Si una falla por un cambio de diseño, el diseño está mal, no la prueba.
 */

const countries = [{ id: 48, name: "Colombia" }, { id: 840, name: "Estados Unidos" }]

const values: ReservationFormValues = {
    guestName: "María",
    guestLastname: "González Pérez",
    guestCountry: "Colombia",
    emailGuest: "maria@correo.com",
    guestPhone: "+57 300 123 4567",
    propertyUuid: "prop-1",
    listingId: "listing-uuid-1",
    reservationSourceId: "22",
    dates: { from: new Date(2026, 11, 12), to: new Date(2026, 11, 15) },
    totalGuests: 2,
    totalPrice: 650000,
    currency: "COP",
    sendLinkNow: true,
}

describe("buildReservationPayload — el contrato con el backend, congelado", () => {
    it("crear: la forma exacta, con el código manual y el estado Confirmada", () => {
        expect(buildReservationPayload(values, { mode: "create", countries, externalId: () => "MANUAL-ABC123" })).toEqual({
            listingUuid: "listing-uuid-1",
            listing_uuid: "listing-uuid-1",
            listingId: "listing-uuid-1",
            listing_id: "listing-uuid-1",
            reservationSourceId: 22,
            arrivalDate: "2026-12-12",
            departureDate: "2026-12-15",
            emailGuest: "maria@correo.com",
            totalGuests: 2,
            currency: "COP",
            totalPrice: 650000,
            extra: {
                guest_name: "María",
                guest_lastname: "González Pérez",
                guest_country: "Colombia",
                guest_country_id: 48,
                guest_phone: "+57 300 123 4567",
            },
            externalId: "MANUAL-ABC123",
            statusReservationId: 27,
        })
    })

    it("editar: la misma forma SIN externalId ni estado (no se regenera el código ni se reinicia la reserva)", () => {
        const payload = buildReservationPayload(values, { mode: "edit", countries })
        expect("externalId" in payload).toBe(false)
        expect("statusReservationId" in payload).toBe(false)
        expect(payload).toMatchObject({ listingUuid: "listing-uuid-1", totalPrice: 650000, extra: { guest_country_id: 48 } })
    })

    it("propiedad y «enviar link» NO viajan: son del formulario", () => {
        const payload = buildReservationPayload(values, { mode: "create", countries })
        expect(JSON.stringify(payload)).not.toContain("prop-1")
        expect("sendLinkNow" in payload).toBe(false)
        expect("propertyUuid" in payload).toBe(false)
    })

    it("un solo día marcado = una noche; un país fuera del catálogo = id null; solo prefijo = sin teléfono", () => {
        const payload = buildReservationPayload(
            { ...values, dates: { from: new Date(2026, 11, 12), to: undefined }, guestCountry: "Atlántida", guestPhone: "+57" },
            { mode: "create", countries },
        )
        expect(payload).toMatchObject({ arrivalDate: "2026-12-12", departureDate: "2026-12-13" })
        expect(payload.extra).toMatchObject({ guest_country: "Atlántida", guest_country_id: null, guest_phone: null })
    })

    it("el código manual tiene la forma MANUAL-XXXXXX", () => {
        expect(manualExternalId()).toMatch(/^MANUAL-[A-Z0-9]{1,6}$/)
        expect(manualExternalId(() => 0.123456789)).toBe("MANUAL-4FZZZX")
    })

    it("los 422 del backend se anclan a los campos del formulario", () => {
        expect(FORM_FIELD_BY_API_KEY).toEqual({
            arrivalDate: "dates", departureDate: "dates", listingId: "listingId", listingUuid: "listingId",
            emailGuest: "emailGuest", totalGuests: "totalGuests", totalPrice: "totalPrice", currency: "currency",
            reservationSourceId: "reservationSourceId",
        })
    })
})

describe("reservationSchema — qué es requerido", () => {
    const base = { ...values, totalPrice: "650000", totalGuests: "2" }

    it("el teléfono es opcional; el correo y el resto, requeridos", () => {
        expect(reservationSchema.safeParse({ ...base, guestPhone: undefined }).success).toBe(true)
        expect(reservationSchema.safeParse({ ...base, guestPhone: "" }).success).toBe(true)
        expect(reservationSchema.safeParse({ ...base, emailGuest: "maria@correo" }).success).toBe(false)
        expect(reservationSchema.safeParse({ ...base, guestCountry: "" }).success).toBe(false)
        expect(reservationSchema.safeParse({ ...base, listingId: "" }).success).toBe(false)
    })

    it("precio vacío bloquea; 0 escrito es válido; negativo no", () => {
        const empty = reservationSchema.safeParse({ ...base, totalPrice: "" })
        expect(empty.success).toBe(false)
        expect(empty.success ? "" : empty.error.issues[0].message).toBe("Escribe el precio total (0 si no tiene costo)")
        const zero = reservationSchema.safeParse({ ...base, totalPrice: "0" })
        expect(zero.success && zero.data.totalPrice).toBe(0)
        expect(reservationSchema.safeParse({ ...base, totalPrice: "-1" }).success).toBe(false)
        const decimal = reservationSchema.safeParse({ ...base, totalPrice: "12.5" })
        expect(decimal.success && decimal.data.totalPrice).toBe(12.5)
    })

    it("el precio se lee como se escribe: «650.000» es seiscientos cincuenta mil, no 650", () => {
        const read = (totalPrice: string) => { const r = reservationSchema.safeParse({ ...base, totalPrice }); return r.success ? r.data.totalPrice : r.error.issues[0].message }
        expect(read("650.000")).toBe(650000)
        expect(read("650,000")).toBe(650000)
        expect(read("1.234,56")).toBe(1234.56)
        expect(read("1,234.56")).toBe(1234.56)
        expect(read("650,5")).toBe(650.5)
        expect(read("650.0000")).toBe("El precio debe ser un número, por ejemplo 650000, 650.000 o 650.000,50")
        expect(read("1.23.4")).toBe("El precio debe ser un número, por ejemplo 650000, 650.000 o 650.000,50")
    })

    it("huéspedes se convierte a número y exige al menos 1", () => {
        expect(reservationSchema.safeParse({ ...base, totalGuests: "0" }).success).toBe(false)
        const two = reservationSchema.safeParse(base)
        expect(two.success && two.data.totalGuests).toBe(2)
    })
})
