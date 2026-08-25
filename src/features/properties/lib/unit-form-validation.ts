/**
 * Validación del formulario de unidad/alojamiento (modal "Añadir Unidad").
 *
 * Existe porque ese diálogo NO tiene resolver de zod —el formulario de propiedad
 * sí, pero el modal vive en su propio `useState`— así que hasta ahora la única
 * regla que se comprobaba antes de llamar a la API era el nombre. Todo lo demás
 * llegaba al backend y volvía como un 422 crudo, después de que el PM llenara
 * cinco pestañas.
 *
 * Los límites NO están inventados: salen de la tabla de `listings` en
 * `docs/API_DOCUMENTATION.md` (líneas 2165-2178). Se declaran como constantes
 * exportadas para que el `maxLength` del input y la validación no puedan
 * separarse — que es exactamente cómo se cuelan estos errores.
 *
 * Lógica pura, sin React: es una tabla de reglas, y es lo único de este modal
 * que merece pruebas.
 */

/** Pestaña donde vive cada campo — permite saltar a la que tiene el error. */
export type UnitFormTab = "general" | "amenities" | "rooms" | "policies"

export interface UnitFieldError {
    /** Clave del campo en `unitForm`, para pintar el error bajo su input. */
    field: string
    message: string
    tab: UnitFormTab
}

// ── Límites del backend (docs/API_DOCUMENTATION.md, tabla `listings`) ────────
export const UNIT_LIMITS = {
    /** `name`: máx 120 caracteres. */
    name: 120,
    /** `internal_name`: máx 15 caracteres. El más estrecho y el menos evidente. */
    internalName: 15,
    /** `contact_name`: máx 255 caracteres. */
    contactName: 255,
    /** `contact_email`: máx 60 caracteres. */
    contactEmail: 60,
    /** `contact_phone`: máx 60 caracteres. */
    contactPhone: 60,
} as const

/** Mínimo que ya exigía el modal antes de esta validación; se conserva. */
export const UNIT_NAME_MIN_LENGTH = 2

/**
 * Formato de correo — deliberadamente permisivo.
 *
 * No se usa el patrón "exhaustivo" de RFC: el objetivo acá es atajar el error
 * de tipeo obvio (falta @, falta dominio, espacios), no rechazar direcciones
 * raras pero válidas. Quien decide de verdad es el backend; una regex agresiva
 * en el front sólo consigue bloquear a un PM con un correo legítimo.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Subconjunto de `unitForm` que estas reglas miran. */
export interface UnitFormValues {
    name?: string | null
    roomTypeId?: string | number | null
    internalName?: string | null
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    price?: string | number | null
    extra?: {
        maxOccupancy?: string | number | null
        bedRoom?: string | number | null
        bathRoom?: string | number | null
    } | null
}

const text = (value: string | null | undefined): string => String(value ?? "").trim()

/**
 * Devuelve TODOS los errores, no el primero.
 *
 * Es intencional: mostrarlos de a uno obliga al PM a guardar, corregir y volver
 * a guardar por cada campo. La pestaña del primer error es la que se abre, pero
 * los demás ya quedan marcados bajo su input.
 */
export function validateUnitForm(form: UnitFormValues): UnitFieldError[] {
    const errors: UnitFieldError[] = []

    const name = text(form.name)
    if (name.length < UNIT_NAME_MIN_LENGTH) {
        errors.push({
            field: "name",
            message: `El nombre necesita al menos ${UNIT_NAME_MIN_LENGTH} caracteres.`,
            tab: "general",
        })
    } else if (name.length > UNIT_LIMITS.name) {
        errors.push({
            field: "name",
            message: `El nombre no puede superar ${UNIT_LIMITS.name} caracteres.`,
            tab: "general",
        })
    }

    // El límite más estrecho del recurso y el que menos se intuye: "Apto 105
    // Insula" como nombre interno ya se pasa. Sin esta regla el 422 llegaba sin
    // decir cuál era el campo.
    const internalName = text(form.internalName)
    if (internalName.length > UNIT_LIMITS.internalName) {
        errors.push({
            field: "internalName",
            message: `El nombre interno no puede superar ${UNIT_LIMITS.internalName} caracteres.`,
            tab: "general",
        })
    }

    const roomTypeId = Number(form.roomTypeId)
    if (!Number.isInteger(roomTypeId) || roomTypeId <= 0) {
        errors.push({
            field: "roomTypeId",
            message: "Selecciona una categoría de alojamiento válida.",
            tab: "general",
        })
    }

    // La UI ya marca este campo con asterisco de requerido — pero nada lo
    // comprobaba antes de enviar, así que el asterisco era decorativo y el
    // rechazo llegaba del backend.
    const contactEmail = text(form.contactEmail)
    if (!contactEmail) {
        errors.push({
            field: "contactEmail",
            message: "El correo electrónico de contacto es obligatorio.",
            tab: "general",
        })
    } else if (!EMAIL_PATTERN.test(contactEmail)) {
        errors.push({
            field: "contactEmail",
            message: "Escribe un correo electrónico válido.",
            tab: "general",
        })
    } else if (contactEmail.length > UNIT_LIMITS.contactEmail) {
        errors.push({
            field: "contactEmail",
            message: `El correo no puede superar ${UNIT_LIMITS.contactEmail} caracteres.`,
            tab: "general",
        })
    }

    if (text(form.contactName).length > UNIT_LIMITS.contactName) {
        errors.push({
            field: "contactName",
            message: `El nombre de contacto no puede superar ${UNIT_LIMITS.contactName} caracteres.`,
            tab: "general",
        })
    }

    if (text(form.contactPhone).length > UNIT_LIMITS.contactPhone) {
        errors.push({
            field: "contactPhone",
            message: `El teléfono no puede superar ${UNIT_LIMITS.contactPhone} caracteres.`,
            tab: "general",
        })
    }

    // El precio va a `extra.startPrice` como `Number(price) || 0`: un valor no
    // numérico o negativo se convertía en 0 en silencio y la unidad quedaba
    // publicada sin precio, sin que nadie lo notara hasta la primera reserva.
    const rawPrice = text(typeof form.price === "number" ? String(form.price) : form.price)
    if (rawPrice) {
        const price = Number(rawPrice)
        if (!Number.isFinite(price)) {
            errors.push({ field: "price", message: "El precio debe ser un número.", tab: "general" })
        } else if (price < 0) {
            errors.push({ field: "price", message: "El precio no puede ser negativo.", tab: "general" })
        }
    }

    const positiveIntegerFields = [
        ["maxOccupancy", form.extra?.maxOccupancy, "La capacidad máxima"],
        ["bedRoom", form.extra?.bedRoom, "La cantidad de habitaciones o camas"],
        ["bathRoom", form.extra?.bathRoom, "La cantidad de baños"],
    ] as const

    for (const [field, rawValue, label] of positiveIntegerFields) {
        const value = Number(rawValue)
        if (!Number.isInteger(value) || value < 1) {
            errors.push({
                field,
                message: `${label} debe ser un número entero mayor que cero.`,
                tab: field === "maxOccupancy" ? "general" : "rooms",
            })
        }
    }

    return errors
}

/** Indexa los errores por campo, que es como los consume el render. */
export function toFieldErrorMap(errors: UnitFieldError[]): Record<string, string> {
    const map: Record<string, string> = {}
    for (const error of errors) {
        // El primero gana: las reglas se evalúan de la más básica a la más
        // específica, así que "falta el correo" pesa más que "formato inválido".
        if (!(error.field in map)) map[error.field] = error.message
    }
    return map
}
