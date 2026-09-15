import { afterEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/lib/api-client"
import { automationService } from "./automation-service"
import { errorMessage } from "@/features/reservations/components/automations/automation-status-meta"

/**
 * Contrato 2026-09-15 (§4.5): la fila de identidad dejó de cerrar en
 * `completed` cuando el proveedor NO verificó al huésped. Es el caso que la
 * reserva 3195533 destapó — la tarjeta decía «Completado» sobre una
 * verificación rechazada.
 *
 * Lo que se fija acá es el CABLEADO de esa corrección, que atraviesa dos
 * módulos: el backend puede mandar el código en `lastError` o en
 * `responsePayload.error` (misma forma que `insufficient_balance` y
 * `price_unconfirmed`), y la pantalla tiene que traducirlo igual en los dos
 * casos sin aprender un segundo lugar donde mirar.
 */
describe("fila de identidad que no verificó (identity_not_verified)", () => {
    afterEach(() => vi.restoreAllMocks())

    it("traduce el código llegue donde llegue: lastError o responsePayload.error", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([
            {
                automation_uuid: "identity-1",
                automation_name: "Verificación de Identidad (Principal)",
                provider_slug: "didit",
                status: "failed",
                last_error: "identity_not_verified",
                can_redispatch: false,
            },
            {
                automation_uuid: "identity-2",
                automation_name: "Verificación de Identidad (Secundarios)",
                provider_slug: "textract",
                status: "failed",
                // El backend documenta las dos formas; con `lastError` vacío el
                // código viaja en el payload y hay que sintetizarlo al mismo canal.
                response_payload: { error: "identity_not_verified" },
                can_redispatch: false,
            },
        ])

        const [principal, secundario] = await automationService.getReservationStatus("reservation-1")

        for (const item of [principal, secundario]) {
            expect(item.status).toBe("failed")
            // `canRedispatch: false` es deliberado: la verificación la dispara el
            // huésped desde el portal, y el redespacho siempre respondió 422.
            expect(item.canRedispatch).toBe(false)
            expect(errorMessage(item.lastError)).toContain("no fue aprobada")
            // El código crudo nunca se le muestra al PM.
            expect(errorMessage(item.lastError)).not.toBe("identity_not_verified")
        }
    })

    it("sin el flag del backend, el redespacho NO se asume disponible", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([{
            automation_uuid: "identity-1",
            automation_name: "Verificación de Identidad (Principal)",
            provider_slug: "didit",
            status: "failed",
            last_error: "identity_not_verified",
        }])

        const [item] = await automationService.getReservationStatus("reservation-1")

        expect(item.canRedispatch).toBe(false)
    })
})
