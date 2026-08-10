import { describe, expect, it } from "vitest"
import { AUTOMATION_DEFINITIONS } from "../data/automation-definitions"

describe("automatización de contrato digital", () => {
    it("es opcional y no se presenta como obligatoria", () => {
        const contract = AUTOMATION_DEFINITIONS.find((item) => item.id === "digital-contract")

        expect(contract).toBeDefined()
        expect(contract?.isMandatory).toBe(false)
        expect(contract?.description.toLowerCase()).not.toContain("obligatorio")
    })
})
