import { describe, it, expect } from "vitest"
import { readRecordStatus } from "./record-status"

describe("readRecordStatus — 6 activo, 7 inactivo; lo demás es desconocido", () => {
    it("lee las cuatro formas en que llega el estado", () => {
        expect(readRecordStatus({ statusRecord: { id: 6, name: "Active" } })).toBe("active")
        expect(readRecordStatus({ statusRecordId: 7 })).toBe("inactive")
        expect(readRecordStatus({ status_record_id: "6" })).toBe("active")
        expect(readRecordStatus({ status: "INACTIVE" })).toBe("inactive")
        expect(readRecordStatus({ status: "ACT" })).toBe("active")
    })

    it("el id anidado manda sobre los planos", () => {
        expect(readRecordStatus({ statusRecord: { id: 7 }, statusRecordId: 6 })).toBe("inactive")
    })

    it("ausente o raro NUNCA es activo — incluidos los 1/2 del catálogo inventado", () => {
        expect(readRecordStatus({})).toBe("unknown")
        expect(readRecordStatus(null)).toBe("unknown")
        expect(readRecordStatus({ statusRecordId: 1 })).toBe("unknown")
        expect(readRecordStatus({ statusRecordId: 2 })).toBe("unknown")
        expect(readRecordStatus({ status: "otro" })).toBe("unknown")
    })
})
