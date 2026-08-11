import { describe, expect, it } from "vitest"
import {
    normalizeAutomationStatus,
    normalizeExecutionOrder,
    normalizeOptionalId,
} from "./automation-numbers"

describe("normalización numérica de automatizaciones", () => {
    it("reconoce el estado activo tanto numérico como serializado", () => {
        expect(normalizeAutomationStatus(8)).toBe(8)
        expect(normalizeAutomationStatus("8")).toBe(8)
    })

    it("mantiene inactivo cualquier estado ausente o no permitido", () => {
        for (const value of [10, "10", null, undefined, "", "activo", 99]) {
            expect(normalizeAutomationStatus(value)).toBe(10)
        }
    })

    it("normaliza providerId y executionOrder recibidos como cadenas", () => {
        expect(normalizeOptionalId("1004")).toBe(1004)
        expect(normalizeOptionalId(null)).toBeNull()
        expect(normalizeExecutionOrder("2")).toBe(2)
    })
})
