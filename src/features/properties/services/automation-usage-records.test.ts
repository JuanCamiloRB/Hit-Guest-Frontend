import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/api-client", () => ({
    apiClient: { get: mocks.get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    handleSessionExpired: vi.fn(),
}))

import { automationService } from "./automation-service"
import { recordDetail } from "@/features/reservations/components/automations/AutomationHistoryModal"

describe("automationService.listUsageRecords — cancelación (tablero, fase 1)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("entrega el mismo AbortSignal a apiClient.get", async () => {
        mocks.get.mockResolvedValue({ data: [] })
        const controller = new AbortController()

        await automationService.listUsageRecords("res-1", undefined, controller.signal)

        expect(mocks.get).toHaveBeenCalledWith(
            expect.stringMatching(/\/reservations\/res-1\/automation-records$/),
            { signal: controller.signal },
        )
    })

    it("una cancelación se propaga sin registrarse como error", async () => {
        const aborted = new DOMException("The operation was aborted.", "AbortError")
        mocks.get.mockRejectedValue(aborted)

        await expect(automationService.listUsageRecords("res-1", undefined, new AbortController().signal)).rejects.toBe(aborted)
        expect(console.error).not.toHaveBeenCalled()
    })

    it("un fallo real sí se registra y se propaga", async () => {
        const failure = new Error("HTTP 500")
        mocks.get.mockRejectedValue(failure)

        await expect(automationService.listUsageRecords("res-1")).rejects.toBe(failure)
        expect(console.error).toHaveBeenCalledWith("[AutomationService] listUsageRecords error:", failure)
    })
})

describe("automationService.listUsageRecords — mensaje del proveedor (nota backend 2026-11-11)", () => {
    beforeEach(() => vi.clearAllMocks())

    const raw = (payload: Record<string, unknown>) => ({
        id: 9, status: "pending", billable: false, unitCost: 0,
        lastError: { message: "credentials_rejected" },
        responsePayload: payload,
    })

    it("de la respuesta de la API al detalle visible: el código traducido y el texto del proveedor", async () => {
        mocks.get.mockResolvedValue({ data: [raw({ provider_message: "  [infoEmpresaNoActualizada] ", credential_rejection_id: 77, token: "no-entra" })] })
        const [record] = await automationService.listUsageRecords("res-1")
        expect(record.responsePayload).toEqual({ provider_message: "[infoEmpresaNoActualizada]" })
        expect(recordDetail(record)).toBe(
            "En espera: el proveedor rechazó las credenciales. Se reanuda sola al guardar las credenciales. Mensaje del proveedor: [infoEmpresaNoActualizada]",
        )
    })

    it("un provider_message que no es texto no entra", async () => {
        mocks.get.mockResolvedValue({ data: [raw({ provider_message: { secreto: "x" } }), raw({ provider_message: "   " })] })
        const records = await automationService.listUsageRecords("res-1")
        for (const record of records) expect(record.responsePayload).toEqual({})
    })
})
