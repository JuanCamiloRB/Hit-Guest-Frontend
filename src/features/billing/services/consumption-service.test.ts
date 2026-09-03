import { describe, expect, it, vi } from "vitest"
import { consumptionService } from "./consumption-service"
import { automationService } from "@/features/properties/services/automation-service"
import type { Reservation } from "@/types"

vi.mock("@/features/properties/services/automation-service", async (importOriginal) => ({
    // `classifyRecord` importa `canonicalSlug` del mismo módulo: se conserva lo
    // real y solo se dobla el fetch.
    ...(await importOriginal<typeof import("@/features/properties/services/automation-service")>()),
    automationService: { listUsageRecords: vi.fn() },
}))

const reserva = {
    id: "res-1",
    guestName: "Didier Van den Hove",
    unitName: "Tree House Tipo B",
    propertyName: "Pullman",
    checkIn: new Date("2026-09-01"),
} as unknown as Reservation

describe("getReservationCosts — la firma gratuita no desaparece del desglose", () => {
    it("una firma exitosa no facturable marca freeCount en CONTRATO con total 0", async () => {
        // El caso real (2026-09-03): reserva con firma digital nativa — la única
        // automatización gratuita por contrato — mostraba "—" y se leía como
        // valor perdido.
        vi.mocked(automationService.listUsageRecords).mockResolvedValue([
            {
                id: 1, status: "completed", billable: false, unitCost: null,
                providerSlug: "hitguest_signature", automationName: "Digital Signature for Contract",
            },
        ] as never)

        const [cost] = await consumptionService.getReservationCosts([reserva])
        const contrato = cost.lineItems.find((l) => l.category === "contract")!

        expect(contrato.freeCount).toBe(1)
        expect(contrato.consumed).toBe(false)
        expect(cost.total).toBe(0)
    })

    it("lo facturable suma monto y lo fallido no cuenta ni gratis", async () => {
        vi.mocked(automationService.listUsageRecords).mockResolvedValue([
            { id: 1, status: "completed", billable: true, unitCost: "0.75", providerSlug: "didit" },
            { id: 2, status: "failed", billable: false, providerSlug: "hitguest_signature" },
        ] as never)

        const [cost] = await consumptionService.getReservationCosts([reserva])

        expect(cost.lineItems.find((l) => l.category === "checkin")!.amount).toBeCloseTo(0.75)
        expect(cost.lineItems.find((l) => l.category === "contract")!.freeCount).toBe(0)
        expect(cost.total).toBeCloseTo(0.75)
    })
})
