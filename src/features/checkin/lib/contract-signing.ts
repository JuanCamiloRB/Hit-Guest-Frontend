import type { PortalContractInfo, SigningProvider } from "@/features/checkin/types/checkin"

/**
 * Estado del contrato tal como lo tiene que ver el huésped, derivado del
 * `contract` que publica `GET /checkin/{uuid}`.
 *
 * Existe porque el mismo dato se lee desde TRES pantallas con conclusiones
 * distintas —`WelcomeScreen` (qué acción ofrecer en el hub), `ContractScreen`
 * (si dejar firmar o bloquear) y `SuccessScreen` (qué tarjeta mostrar y si hay
 * que sondear)— y hasta ahora cada una lo reinterpretaba a mano. Con la firma
 * externa de TuFirma eso dejó de ser inocuo: `status: "pending"` significa "el
 * huésped tiene que ir a su correo", y una pantalla que lo lea como "todavía no
 * empezó" lo manda a firmar de nuevo algo que ya se envió.
 *
 * Es lógica pura y sin React a propósito: el árbol de casos (proveedor × estado
 * × URL firmada) es lo que hay que poder testear, no el JSX que lo pinta.
 *
 * - `not_configured`    → la propiedad no tiene contrato digital para el canal de
 *                         esta reserva. No hay nada que firmar ni que esperar.
 * - `awaiting_guest`    → falta la acción del huésped DENTRO del portal (leer,
 *                         aceptar y, si el proveedor es nativo, firmar).
 * - `awaiting_external` → exclusivo de TuFirma: el contrato ya se envió y el
 *                         huésped tiene que firmarlo desde el correo, fuera de
 *                         HIT. No hay nada que pueda hacer en esta pantalla.
 * - `finalizing`        → firmado, pero el PDF todavía no se puede descargar.
 * - `available`         → hay PDF firmado descargable.
 * - `rejected`          → `SIGNER_REJECTED` / `SIGNER_FAILED`. Terminal para el
 *                         huésped: no existe endpoint de reenvío que pueda
 *                         llamar, lo resuelve el anfitrión.
 */
export type ContractSigningState =
    | "not_configured"
    | "awaiting_guest"
    | "awaiting_external"
    | "finalizing"
    | "available"
    | "rejected"

/** El backend manda el slug `hitguest_signature`; se tolera `hitguest` a secas. */
export function isNativeProvider(provider: SigningProvider | null | undefined): boolean {
    return !!provider && provider.includes("hitguest")
}

export function isExternalProvider(provider: SigningProvider | null | undefined): boolean {
    return provider === "tufirma"
}

/**
 * El orden de las ramas es la parte que importa, y por eso está acá y no
 * repartido en tres componentes:
 *
 * 1. Sin proveedor no hay contrato — cualquier `status` que llegue es ruido de
 *    un backend viejo, no un estado que mostrar.
 * 2. `rejected` gana sobre todo lo demás. Es lo único que el huésped NO puede
 *    resolver solo, así que callarlo detrás de una descarga o de un spinner lo
 *    deja creyendo que su registro quedó en orden.
 * 3. `signedContractUrl` es la ÚNICA señal válida de que se puede descargar: el
 *    backend la publica exactamente cuando el PDF existe. `status: "signed"` se
 *    pone en cuanto el titular firma —antes de que el archivo exista— así que
 *    derivar la descarga del estado mostraba un botón que fallaba.
 * 4. Recién ahí se distingue "esperando al huésped acá" de "esperando al huésped
 *    en TuFirma", que es la ambigüedad que el proveedor resuelve.
 */
export function resolveContractSigningState(
    contract: PortalContractInfo | null | undefined,
): ContractSigningState {
    if (!contract?.signingProvider) return "not_configured"

    if (contract.status === "rejected") return "rejected"

    if (contract.signedContractUrl) return "available"

    switch (contract.status) {
        case "pending":
            // La misma palabra significa cosas opuestas según el proveedor: con
            // TuFirma la pelota la tiene el huésped (su correo); con el proveedor
            // nativo no hay nada externo que esperar, es el backend terminando.
            return isExternalProvider(contract.signingProvider) ? "awaiting_external" : "finalizing"
        case "signed":
        case "completed":
            return "finalizing"
        default:
            return "awaiting_guest"
    }
}

/**
 * Estados en los que el contrato todavía puede cambiar solo (webhook de TuFirma
 * o generación del PDF). Es la condición para sondear el portal: fuera de estos
 * dos, sondear no puede aportar nada y solo gasta requests.
 */
export function isContractTransitional(state: ContractSigningState): boolean {
    return state === "awaiting_external" || state === "finalizing"
}

/**
 * ¿Hay que impedirle al titular volver a enviar el formulario del contrato?
 *
 * Cubre el reingreso, que es donde el flujo asíncrono se rompía: con TuFirma
 * `/main/complete` responde `pending_signature` y el titular queda INCOMPLETO
 * hasta que llegue el webhook, así que el hub lo sigue tratando como pendiente y
 * lo devuelve a esta pantalla. Sin este corte volvía a ver el contrato y el
 * botón "Aceptar y Completar" — y al pulsarlo chocaba con que los datos del
 * formulario ya se habían borrado del localStorage tras el envío exitoso, con un
 * "No se encontraron los datos del formulario" que no explica nada.
 *
 * Solo aplica al titular: un acompañante no firma nunca, y bloquearlo por el
 * contrato del titular le impediría completar su propio registro.
 */
export function blocksContractSubmission(
    state: ContractSigningState,
    isMainGuest: boolean,
): boolean {
    if (!isMainGuest) return false
    return state === "awaiting_external" || state === "rejected"
}
