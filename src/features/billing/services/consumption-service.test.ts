import { describe, expect, it, vi } from "vitest"
import { consumptionService, lifetimeCostStats } from "./consumption-service"
import type { ReservationCost } from "../types"
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

describe("getReservationCosts — envío del link (contrato 2026-09-27 §13.6)", () => {
    it("WhatsApp y OTA van a columnas distintas aunque compartan providerSlug", async () => {
        vi.mocked(automationService.listUsageRecords).mockResolvedValue([
            { id: 1, status: "completed", billable: true, unitCost: "0.0625", providerSlug: "whatsapp_checkin_link", channel: "whatsapp" },
            { id: 2, status: "completed", billable: true, unitCost: "0.0625", providerSlug: "whatsapp_checkin_link", channel: "ota_inbox" },
            { id: 3, status: "completed", billable: true, unitCost: "0.0625", providerSlug: "whatsapp_checkin_link", channel: "ota_inbox" },
        ] as never)

        const [cost] = await consumptionService.getReservationCosts([reserva])

        expect(cost.lineItems.find((l) => l.category === "whatsapp")!.amount).toBeCloseTo(0.0625)
        expect(cost.lineItems.find((l) => l.category === "otaInbox")!.amount).toBeCloseTo(0.125)
        expect(cost.total).toBeCloseTo(0.1875)
    })

    it("un registro histórico sin canal cuenta como WhatsApp", async () => {
        vi.mocked(automationService.listUsageRecords).mockResolvedValue([
            { id: 1, status: "completed", billable: true, unitCost: "0.0625", providerSlug: "whatsapp_checkin_link", channel: null },
        ] as never)

        const [cost] = await consumptionService.getReservationCosts([reserva])

        expect(cost.lineItems.find((l) => l.category === "whatsapp")!.amount).toBeCloseTo(0.0625)
        expect(cost.lineItems.find((l) => l.category === "otaInbox")!.amount).toBe(0)
    })

    it("una ejecución omitida suma exactamente cero aunque llegue completed y billable", async () => {
        vi.mocked(automationService.listUsageRecords).mockResolvedValue([
            {
                id: 1, status: "completed", billable: true, unitCost: "0.0625",
                providerSlug: "whatsapp_checkin_link", channel: "ota_inbox",
                responsePayload: { skipped: true, reason: "not_imported_from_pms" },
            },
        ] as never)

        const [cost] = await consumptionService.getReservationCosts([reserva])

        expect(cost.total).toBe(0)
        expect(cost.lineItems.every((l) => l.count === 0 && l.freeCount === 0)).toBe(true)
        expect(cost.nodeRuns).toEqual([])
    })
})

describe("getReservationCost — decisiones destructivas", () => {
    it("propaga el fallo de consulta en vez de confundirlo con costo cero", async () => {
        vi.mocked(automationService.listUsageRecords).mockRejectedValue(new Error("network down"))

        await expect(consumptionService.getReservationCost(reserva)).rejects.toThrow("network down")
    })
})

describe("lifetimeCostStats — reservas y costo promedio de toda la cuenta", () => {
    const today = new Date(2026, 9, 2) // 2 de octubre de 2026
    const cost = (checkIn: Date, total: number): ReservationCost => ({
        reservationId: `r-${checkIn.getTime()}-${total}`, guestName: "", unitName: "", propertyName: "",
        checkIn, lineItems: [], total, nodeRuns: [],
    })

    it("cuenta TODAS las reservas cobradas, sin importar el mes; las de costo 0 no son procesadas", () => {
        const stats = lifetimeCostStats([
            cost(new Date(2026, 7, 10), 2),
            cost(new Date(2026, 8, 5), 4),
            cost(new Date(2026, 8, 20), 0),
        ], today)
        expect(stats.processedReservations).toBe(2)
        expect(stats.avgPerReservation).toBe(3)
    })

    it("sin reservas cobradas el promedio es desconocido, no 0", () => {
        const stats = lifetimeCostStats([cost(new Date(2026, 8, 5), 0)], today)
        expect(stats).toEqual({ processedReservations: 0, avgPerReservation: null, avgTrend: null })
    })

    it("la tendencia compara el último mes con reservas contra el anterior con reservas", () => {
        const stats = lifetimeCostStats([
            cost(new Date(2026, 6, 3), 2),   // julio: promedio 2
            cost(new Date(2026, 8, 5), 2),   // septiembre: promedio (2 + 3) / 2 = 2,5
            cost(new Date(2026, 8, 25), 3),
        ], today)
        // Agosto no tuvo reservas: la base es julio, no un «agosto en 0».
        expect(stats.avgTrend?.month).toEqual(new Date(2026, 8, 1))
        expect(stats.avgTrend?.baselineMonth).toEqual(new Date(2026, 6, 1))
        expect(stats.avgTrend?.deltaPct).toBeCloseTo(0.25)
    })

    it("un costo promedio que baja da un delta negativo", () => {
        const stats = lifetimeCostStats([cost(new Date(2026, 7, 3), 4), cost(new Date(2026, 8, 3), 3)], today)
        expect(stats.avgTrend?.deltaPct).toBeCloseTo(-0.25)
    })

    it("una reserva futura suma al total pero no define la tendencia", () => {
        const stats = lifetimeCostStats([
            cost(new Date(2026, 7, 3), 2),
            cost(new Date(2026, 8, 3), 2),
            cost(new Date(2026, 10, 15), 8), // noviembre: ya verificada, todavía no ocurre
        ], today)
        expect(stats.processedReservations).toBe(3)
        expect(stats.avgPerReservation).toBe(4)
        expect(stats.avgTrend?.month).toEqual(new Date(2026, 8, 1))
        expect(stats.avgTrend?.deltaPct).toBe(0)
    })

    it("con un solo mes de reservas no hay tendencia", () => {
        expect(lifetimeCostStats([cost(new Date(2026, 8, 3), 2)], today).avgTrend).toBeNull()
    })

    it("analyze expone las cifras de cuenta aunque el mes elegido no tenga reservas", () => {
        const { summary } = consumptionService.analyze(
            [cost(new Date(2026, 7, 3), 2), cost(new Date(2026, 8, 3), 4)],
            new Date(2026, 9, 1),
            today,
        )
        expect(summary.monthTotal).toBe(0)
        expect(summary.lifetime.processedReservations).toBe(2)
        expect(summary.lifetime.avgPerReservation).toBe(3)
    })
})
