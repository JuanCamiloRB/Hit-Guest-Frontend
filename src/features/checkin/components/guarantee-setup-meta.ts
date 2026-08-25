import type { GuaranteeSetupIntent } from "@/features/checkin/types/checkin"

/**
 * Por qué falló la preparación del formulario de tarjeta, y qué se le dice al
 * huésped en cada caso.
 *
 * ## El bug que lo motivó
 *
 * `GuaranteeCardForm` mostraba **un solo texto** —«No pudimos preparar el
 * formulario de tarjeta. Intenta de nuevo.»— para al menos tres causas
 * distintas: un 200 sin `publishableKey` usable, el contenedor del campo sin
 * montar, y una excepción de Stripe Elements. Observado en producción el
 * 2026-08-19 con el backend respondiendo **200**: el huésped quedaba trabado en
 * «Preparando formulario…» y nadie podía saber por qué, porque el `catch`
 * genérico se tragaba la excepción y un `console.error` en un iPhone no existe.
 *
 * Sigue el precedente de `DOC_ERROR_UI` (`VerifyScreen.tsx`), el patrón OCP que
 * ya usa este repo: una causa nueva es **una entrada más en el record**, no un
 * `if` más en la rama de manejo.
 *
 * ## Dos decisiones que parecen omisiones y no lo son
 *
 * **Estas causas son LOCALES del frontend, y por eso no viajan en `errorType`.**
 * Ese campo es del backend (`UNSUPPORTED_DOCUMENT_LAYOUT`, `FACE_MISMATCH`…).
 * Meterle valores nuestros sería inventar contrato por la puerta de atrás: el
 * día que el backend defina un `errorType` con el mismo nombre, los dos
 * significados colisionan en silencio.
 *
 * **`canRetry: false` no es pesimismo, es honestidad.** Cuando falta la llave de
 * Stripe el huésped puede tocar «reintentar» cien veces y va a fallar cien
 * veces: el problema está en la configuración de la cuenta, no de su lado.
 * Ofrecer un botón inútil ahí es peor que no ofrecer ninguno, y además cada
 * intento crea una fila de método de pago `pending` en el backend (el endpoint
 * **no es idempotente**, ver skill `hitguest-api-contracts` §2c).
 */
export type GuaranteeSetupFailure =
    /** El POST resolvió 200 pero sin `clientSecret` / `publishableKey` usables. */
    | "incomplete_payload"
    /** `loadStripe` rechazó: la llave no es un string válido para Stripe.js. */
    | "stripe_rejected"
    /** `loadStripe` resolvió `null`: js.stripe.com nunca cargó (adblock/CSP/red). */
    | "stripe_blocked"
    /** El nodo host del campo no estaba en el DOM al momento de montar. */
    | "container_missing"
    /** `elements.create()` / `card.mount()` lanzaron. */
    | "elements_failed"
    /** El POST falló (4xx/5xx/red). El 401 NO llega acá: lo maneja la sesión. */
    | "backend_error"

export interface GuaranteeSetupFailureUI {
    message: string
    /** Si reintentar puede cambiar el resultado. Ver el JSDoc de arriba. */
    canRetry: boolean
    /**
     * Referencia corta y estable que el huésped puede leer por WhatsApp.
     *
     * Existe porque el diagnóstico de este bug costó dos días de ida y vuelta
     * con backend mirando un log en verde: sin esto, la única forma de saber la
     * causa es conectar el móvil a un Mac y abrir la consola.
     */
    ref: string
}

const GUARANTEE_SETUP_FAILURE_UI: Record<GuaranteeSetupFailure, GuaranteeSetupFailureUI> = {
    incomplete_payload: {
        message: "No pudimos iniciar el registro de la tarjeta. Avisa al anfitrión para que revise la configuración de pagos del alojamiento.",
        canRetry: false,
        ref: "SETUP-PAYLOAD",
    },
    stripe_rejected: {
        message: "El sistema de pagos rechazó la configuración de este alojamiento. Avisa al anfitrión para que la revise.",
        canRetry: false,
        ref: "SETUP-KEY",
    },
    // Texto conservado tal cual del código anterior: es el único de los seis que
    // ya distinguía su causa, y el huésped SÍ puede resolverlo por su cuenta.
    stripe_blocked: {
        message: "No pudimos cargar el formulario de pago seguro. Si usas un bloqueador de anuncios, desactívalo para este sitio e intenta de nuevo.",
        canRetry: true,
        ref: "SETUP-BLOCKED",
    },
    container_missing: {
        message: "No pudimos preparar el formulario de tarjeta. Intenta de nuevo.",
        canRetry: true,
        ref: "SETUP-DOM",
    },
    elements_failed: {
        message: "No pudimos mostrar el formulario de tarjeta. Intenta de nuevo.",
        canRetry: true,
        ref: "SETUP-ELEMENTS",
    },
    backend_error: {
        message: "No pudimos preparar el formulario de tarjeta. Intenta de nuevo.",
        canRetry: true,
        ref: "SETUP-HTTP",
    },
}

export function describeGuaranteeSetupFailure(cause: GuaranteeSetupFailure): GuaranteeSetupFailureUI {
    return GUARANTEE_SETUP_FAILURE_UI[cause]
}

/** Los dos campos sin los cuales no se puede montar nada, ya garantizados. */
export interface UsableSetupIntent {
    clientSecret: string
    publishableKey: string
}

function readNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
}

/**
 * Decide si un 200 del setup-intent alcanza para montar el formulario.
 *
 * **Un 200 cuyo payload no permite continuar no es un éxito.** Hasta ahora el
 * front lo trataba como tal y reventaba tres líneas después, dentro de
 * `loadStripe`, con un error irreconocible: `@stripe/stripe-js@9` lanza
 * `"Expected publishable key to be of type string"` (`dist/index.js:166`) si la
 * llave no es string, y el `IntegrationError` de Stripe.js si es `""`.
 *
 * El tipo declara `clientSecret: string` y `publishableKey: string`, así que
 * TypeScript da estos chequeos por imposibles — por eso hay que hacerlos en
 * runtime: el tipo describe lo que el contrato **promete**, no lo que la
 * respuesta **trae**. Es la misma lección que ya dejó `guaranteeAmount`, que se
 * tuvo que redeclarar `string | number | null` cuando se vio lo que llegaba.
 *
 * ⚠️ El tipo público NO se cambió a nullable a propósito: está **abierto** con
 * backend si un 200 puede omitir estos campos (skill `hitguest-api-contracts`
 * §2c). Declararlo nullable por una sospecha sería inventar el contrato en la
 * dirección contraria.
 *
 * `guaranteeAmount` y `currency` **no** se validan acá: sin ellos solo se deja
 * de mostrar el texto informativo del monto, y bloquear la tokenización por un
 * dato decorativo sería peor que no mostrarlo.
 */
export function readUsableSetupIntent(
    intent: GuaranteeSetupIntent,
): { ok: true; intent: UsableSetupIntent } | { ok: false; cause: GuaranteeSetupFailure } {
    const clientSecret = readNonEmptyString(intent?.clientSecret)
    const publishableKey = readNonEmptyString(intent?.publishableKey)

    if (!clientSecret || !publishableKey) {
        return { ok: false, cause: "incomplete_payload" }
    }
    return { ok: true, intent: { clientSecret, publishableKey } }
}
