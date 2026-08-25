import type { CheckinPortalResponse } from "../types/checkin"

/**
 * Clasificación de un 200 de `GET /checkin/{uuid}` ANTES de que llegue a React.
 *
 * Existe por el incidente del 2026-08-20 16:44:36Z (skill
 * `hitguest-api-contracts` §3): `/main/complete` respondió 200 y en el mismo
 * minuto el huésped vio el error boundary del segmento — el render de /success
 * asume `reservation`/`progress`/`registeredGuests` presentes, y el try de cada
 * página envuelve solo el fetch, nunca el render. Un 200 con el shape
 * incompleto (posible durante la transacción de completar — pregunta abierta
 * con backend) reventaba como TypeError DESPUÉS de que el check-in ya estaba
 * persistido.
 *
 * El piso que se valida es **lo que revienta el render**, no el contrato
 * completo: un campo cosmético ausente (fechas, contadores) se muestra mal pero
 * no bloquea, y exigirlo acá convertiría un defecto visual en una pantalla de
 * error. No se inventa contrato — `portalStatus` sin el resto del payload ya es
 * una forma documentada (§3: cancelada/eliminada llega 200 con solo
 * status + message).
 */
export type PortalPayloadKind =
    /** Shape renderizable: las tres claves que el render desreferencia existen. */
    | "ready"
    /** Cancelada (29) / eliminada (108): 200 con solo `portalStatus` + `message`. */
    | "closed"
    /** 200 que no es ni lo uno ni lo otro: tratarlo como fallo de red, no renderizarlo. */
    | "malformed"

export function classifyPortalPayload(payload: unknown): PortalPayloadKind {
    if (typeof payload !== "object" || payload === null) return "malformed"
    const portal = payload as Record<string, unknown>

    if (typeof portal.portalStatus === "string" && portal.portalStatus) return "closed"

    const reservation = portal.reservation as Record<string, unknown> | undefined
    if (
        typeof reservation !== "object" || reservation === null
        || typeof reservation.uuid !== "string" || !reservation.uuid
    ) return "malformed"
    if (typeof portal.progress !== "object" || portal.progress === null) return "malformed"
    if (!Array.isArray(portal.registeredGuests)) return "malformed"

    return "ready"
}

/**
 * Punto único donde un 200 malformado se convierte en error lanzado.
 *
 * Se aplica en el borde de los DOS servicios (`checkinService.getPortal` y
 * `checkinServerService.getPortal*`) a propósito: todos los llamadores —los
 * wrappers server de cada paso, el post-complete de `ContractScreen`, el sondeo
 * de `SuccessScreen`, `resolveSecondaryGate`— ya tienen un catch para el fetch
 * fallido, así que clasificar acá reusa cada fallback existente sin tocar
 * ninguna página. Nunca degradar esto a un warning que devuelva el payload:
 * devolverlo es exactamente lo que reventaba el render.
 */
export function assertRenderablePortal(portal: CheckinPortalResponse): CheckinPortalResponse {
    if (classifyPortalPayload(portal) === "malformed") {
        // Solo las claves raíz: suficiente para diagnosticar el shape sin volcar
        // datos del huésped en los logs.
        console.error(
            "[checkin] Portal 200 con shape no renderizable; se trata como fallo de red. Claves:",
            typeof portal === "object" && portal !== null ? Object.keys(portal) : typeof portal,
        )
        throw new Error("La respuesta de la reserva llegó incompleta.")
    }
    return portal
}
