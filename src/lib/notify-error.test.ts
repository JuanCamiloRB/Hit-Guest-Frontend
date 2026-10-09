import { describe, expect, it } from "vitest"
import { normalizeApiError } from "./notify-error"

describe("normalizeApiError — modo solo lectura dentro de una cuenta ajena", () => {
    it("IMPERSONATION_READ_ONLY explica que no se pueden hacer cambios", () => {
        expect(normalizeApiError({ status: 403, code: "IMPERSONATION_READ_ONLY", message: "Forbidden" }).message)
            .toBe("Estás viendo esta cuenta en modo solo lectura: no se pueden hacer cambios.")
    })
})
