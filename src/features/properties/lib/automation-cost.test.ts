import { describe, it, expect } from "vitest"
import { describeAutomationCost } from "./automation-cost"

describe("describeAutomationCost", () => {
    it("dice el monto con hasta cuatro decimales y la unidad documentada", () => {
        expect(describeAutomationCost({ billable: true, unit_cost: 0.0625, scope: "per_execution" }))
            .toBe("0,0625 USD cada vez que se ejecuta")
    })

    it("sin `scope` o con uno desconocido, el monto solo", () => {
        expect(describeAutomationCost({ billable: true, unit_cost: 1.5 })).toBe("1,50 USD")
        expect(describeAutomationCost({ billable: true, unit_cost: 1.5, scope: "per_month" })).toBe("1,50 USD")
        // Una clave del prototipo no es una unidad.
        expect(describeAutomationCost({ billable: true, unit_cost: 1.5, scope: "toString" })).toBe("1,50 USD")
    })

    it("`withUnit: false` calla la unidad aunque el `scope` sea conocido", () => {
        expect(describeAutomationCost({ billable: true, unit_cost: 0.35, scope: "per_execution" }, { withUnit: false }))
            .toBe("0,35 USD")
    })

    it("distingue gratuita, sin tarifa por ahora y tarifa desconocida", () => {
        expect(describeAutomationCost({ billable: false, unit_cost: 2 })).toBe("Sin costo")
        expect(describeAutomationCost({ billable: true, unit_cost: 0 })).toBe("Sin costo por ahora")
        expect(describeAutomationCost(undefined)).toBe("Puede generar costo")
    })
})
