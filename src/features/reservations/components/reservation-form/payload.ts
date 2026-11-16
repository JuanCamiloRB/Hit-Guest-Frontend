import * as z from "zod"
import { addDays, format } from "date-fns"
import { hasUsablePhone } from "../../lib/checkin-link-delivery-status"

/**
 * El contrato del formulario de reserva manual, SIN React: los valores que
 * captura y el payload exacto que viaja a `POST/PUT /reservations`.
 *
 * Fase 0 del rediseño (plan `20261116_reserva-manual-ux.md`): esto se extrajo
 * tal cual de `ReservationDialog.tsx` y se fijó con pruebas ANTES de mover un
 * solo campo, para que el rediseño no pueda cambiar lo que recibe el backend.
 * Ni un campo más ni uno menos: los 13 del schema son los 13 del diálogo.
 */

// ── Schema ───────────────────────────────────────────────────
export const reservationSchema = z.object({
    // Nombre y apellido separados, igual que en el resto del modelo (GuestProfile,
    // RegisteredGuest, ReservationGuest). `extra` era la única excepción y era
    // decisión del frontend: guardarlo junto obligaba a partirlo después, y
    // partir "María González Pérez" es indecidible en español.
    guestName: z.string().min(2, "El nombre del huésped es requerido").max(60),
    guestLastname: z.string().min(2, "Los apellidos son requeridos").max(60),
    guestCountry: z.string().min(1, "Selecciona el país o nacionalidad"),
    emailGuest: z.string().email("Email inválido").max(60),
    guestPhone: z.string().optional(),

    propertyUuid: z.string().min(1, "Selecciona una propiedad"),
    listingId: z.string().min(1, "Selecciona un alojamiento"),

    reservationSourceId: z.string().min(1, "Selecciona el canal"),

    // Dates — use z.any() for react-day-picker range compatibility
    dates: z.any().refine(
        (val: unknown) => {
            const range = val as { from?: unknown; to?: unknown } | null
            return range?.from instanceof Date && range?.to instanceof Date
        },
        { message: "Selecciona las fechas de llegada y salida" },
    ),

    totalGuests: z.coerce.number().min(1, "Mínimo 1 huésped"),

    // Vacío es «falta completar», no 0: antes `z.coerce` convertía "" en 0 y una
    // reserva sin precio escrito viajaba en 0 sin que nadie lo decidiera. Un 0
    // ESCRITO sigue siendo válido («Sin costo»).
    totalPrice: z
        .union([z.string(), z.number()])
        .transform((raw, ctx) => {
            const text = String(raw).trim()
            if (text === "") {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escribe el precio total (0 si no tiene costo)" })
                return z.NEVER
            }
            const value = Number(text)
            if (Number.isNaN(value)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El precio debe ser un número" })
                return z.NEVER
            }
            if (value < 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El precio debe ser positivo" })
                return z.NEVER
            }
            return value
        }),
    currency: z.string().min(1, "Selecciona moneda"),

    sendLinkNow: z.boolean().optional(),
})

/** Lo que el formulario entrega validado (precio ya numérico). */
export type ReservationFormValues = z.output<typeof reservationSchema>
/** Lo que el formulario guarda mientras se edita (precio como texto). */
export type ReservationFormInput = z.input<typeof reservationSchema>

export interface DateRangeValue {
    from?: Date
    to?: Date
}

/** Campos de la API (claves de un 422) → campo del formulario donde se ancla el error. */
export const FORM_FIELD_BY_API_KEY: Record<string, keyof ReservationFormValues> = {
    arrivalDate: "dates",
    departureDate: "dates",
    listingId: "listingId",
    listingUuid: "listingId",
    emailGuest: "emailGuest",
    totalGuests: "totalGuests",
    totalPrice: "totalPrice",
    currency: "currency",
    reservationSourceId: "reservationSourceId",
}

/** Código manual de una reserva creada en el panel (solo al crear). */
export function manualExternalId(random: () => number = Math.random): string {
    return `MANUAL-${random().toString(36).substring(2, 8).toUpperCase()}`
}

/**
 * El payload de `POST` (crear) o `PUT` (editar) `/reservations`, idéntico al
 * que mandaba el diálogo antes del rediseño.
 *
 * - Salida: si el PM solo marcó un día, se asume una noche.
 * - `guest_country_id`: el selector de país itera el catálogo (que trae `id`)
 *   pero guardaba solo el nombre. Ese id es el mismo `nationalityId` que pide
 *   el check-in; se manda junto al nombre, sin romper lo que ya lee
 *   `guest_country`.
 * - `guest_phone`: el campo deja solo el prefijo (`+57`) al vaciarse; eso no es
 *   un teléfono y guardarlo hacía que el panel prometiera WhatsApp.
 * - Solo al CREAR van el código manual y el estado inicial (27 = Confirmada).
 *   En EDICIÓN se omiten a propósito (contrato §2g): mandarlos regeneraba
 *   `MANUAL-XXXXXX` en cada edición —rompiendo el vínculo de una reserva
 *   importada con su código del PMS— y devolvía el estado a Confirmada.
 */
export function buildReservationPayload(
    values: ReservationFormValues,
    options: {
        mode: "create" | "edit"
        countries: ReadonlyArray<{ id: number | string; name: string }>
        externalId?: () => string
    },
): Record<string, unknown> {
    const dates = values.dates as { from: Date; to?: Date }
    const departure = dates.to && dates.to > dates.from ? dates.to : addDays(dates.from, 1)

    const payload: Record<string, unknown> = {
        listingUuid: values.listingId,
        listing_uuid: values.listingId,
        listingId: values.listingId,
        listing_id: values.listingId,
        reservationSourceId: Number(values.reservationSourceId),
        arrivalDate: format(dates.from, "yyyy-MM-dd"),
        departureDate: format(departure, "yyyy-MM-dd"),
        emailGuest: values.emailGuest,
        totalGuests: values.totalGuests,
        currency: values.currency,
        totalPrice: values.totalPrice,
        extra: {
            guest_name: values.guestName,
            guest_lastname: values.guestLastname,
            guest_country: values.guestCountry,
            guest_country_id: options.countries.find((c) => c.name === values.guestCountry)?.id ?? null,
            guest_phone: hasUsablePhone(values.guestPhone) ? values.guestPhone : null,
        },
    }

    if (options.mode !== "edit") {
        payload.externalId = (options.externalId ?? manualExternalId)()
        payload.statusReservationId = 27
    }

    return payload
}
