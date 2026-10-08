/**
 * Qué pasa justo después de crear una reserva manual.
 *
 * SEGÚN LA DOCUMENTACIÓN del backend (`docs/API_DOCUMENTATION.md`, «Envío
 * automático») el link de check-in sale solo al importar una reserva (PMS o
 * iCal); ⚠️ no está verificado contra producción que `POST /reservations` no
 * dispare además un envío propio — ver la prueba de doble envío en el skill
 * `hitguest-api-contracts` §2e-bis antes de desplegar. La casilla «Enviar link
 * de check-in ahora» del diálogo no viajaba al backend ni disparaba nada: el
 * aviso decía «Se enviará el link» y el huésped no recibía correo (reporte de
 * Ricardo, 2026-10-08). El envío que el PM pide acá es
 * `POST /reservations/{uuid}/send-checkin-link` (contrato 2026-09-19 §3.6,
 * todos los campos opcionales). El 200 significa «encolado», no entregado:
 * la entrega la cuentan después Mailgun y WhatsApp en la ficha.
 *
 * Lógica sin React: se prueba con el cliente HTTP y el servicio simulados.
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { getErrorMessage } from "@/lib/notify-error"
import { reservationsService } from "../services/reservations-service"

export interface CreationOutcome {
    tone: "success" | "warning"
    title: string
    description: string
}

/**
 * Uuid de la reserva recién creada, a partir de lo que ENTREGA `apiClient`,
 * no del JSON crudo: `apiClient` desenvuelve el primer nivel `data`
 * (`src/lib/api-client.ts`), así que la respuesta documentada
 * `{ data: { reservation: { uuid } } }` llega acá como `{ reservation: { uuid } }`.
 * La primera versión de este lector solo miraba la forma cruda y nunca
 * encontraba el uuid: la reserva se creaba y el link no salía (auditoría
 * 2026-10-08). Se toleran también la forma cruda y las planas. `null` = no
 * vino: no se inventa.
 */
export function readCreatedReservationUuid(raw: unknown): string | null {
    if (!raw || typeof raw !== "object") return null
    const r = raw as Record<string, unknown>
    const asRecord = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>
    const data = asRecord(r.data)
    const unwrapped = asRecord(r.reservation)
    const nested = asRecord(data.reservation)
    for (const candidate of [unwrapped.uuid, nested.uuid, data.uuid, r.uuid]) {
        if (typeof candidate === "string" && candidate.trim() !== "") return candidate
    }
    return null
}

export async function followUpCreatedReservation(input: {
    sendLinkNow: boolean
    createdUuid: string | null
    guestName: string
    email: string
    sendLink: (uuid: string) => Promise<string>
    describeError: (error: unknown) => string
}): Promise<CreationOutcome> {
    const { sendLinkNow, createdUuid, guestName, email, sendLink, describeError } = input

    if (!sendLinkNow) {
        return {
            tone: "success",
            title: "Reserva creada exitosamente",
            description: `Reserva para ${guestName} creada. Link no enviado.`,
        }
    }
    if (!createdUuid) {
        return {
            tone: "warning",
            title: "Reserva creada, pero el link no se envió",
            description: "La respuesta no trajo el identificador de la reserva. Envíalo desde la ficha de la reserva.",
        }
    }
    try {
        const message = await sendLink(createdUuid)
        return {
            tone: "success",
            title: "Reserva creada · envío del link solicitado",
            description: `${message || "El backend recibió la solicitud"} · ${email}. La entrega se verá en la ficha de la reserva.`,
        }
    } catch (error) {
        return {
            tone: "warning",
            title: "Reserva creada, pero el link no se envió",
            description: `${describeError(error)} Puedes reenviarlo desde la ficha de la reserva.`,
        }
    }
}

export interface CreateReservationDeps {
    post: (url: string, body: unknown) => Promise<unknown>
    sendLink: (uuid: string) => Promise<string>
    describeError: (error: unknown) => string
}

const REAL_DEPS: CreateReservationDeps = {
    post: (url, body) => apiClient.post<unknown>(url, body),
    sendLink: (uuid) => reservationsService.sendCheckinLink(uuid),
    describeError: (error) => getErrorMessage(error, "No se pudo enviar el link."),
}

/**
 * Crea la reserva y, si la casilla está marcada, pide el envío del link con el
 * uuid que devolvió el POST. Las dependencias se inyectan para poder probar el
 * cableado completo (respuesta de `apiClient` → uuid → una sola llamada de
 * envío) sin montar el formulario. Si el POST falla, el error sube tal cual:
 * el diálogo ya lo traduce a errores de campo.
 */
export async function createReservationWithFollowUp(
    input: { payload: unknown; sendLinkNow: boolean; guestName: string; email: string },
    deps: CreateReservationDeps = REAL_DEPS,
): Promise<CreationOutcome> {
    const created = await deps.post(`${API_BASE}/reservations`, input.payload)
    return followUpCreatedReservation({
        sendLinkNow: input.sendLinkNow,
        createdUuid: readCreatedReservationUuid(created),
        guestName: input.guestName,
        email: input.email,
        sendLink: deps.sendLink,
        describeError: deps.describeError,
    })
}
