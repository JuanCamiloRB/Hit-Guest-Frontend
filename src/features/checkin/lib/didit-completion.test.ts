import { describe, expect, it } from "vitest"
import { diditCompletionAction } from "./didit-completion"

describe("diditCompletionAction", () => {
    it("reconcilia todo completed sin exigir session.status=Approved", () => {
        expect(diditCompletionAction({ type: "completed" })).toBe("reconcile")
    })

    it("distingue cancelación y fallo del SDK", () => {
        expect(diditCompletionAction({ type: "cancelled" })).toBe("cancelled")
        expect(diditCompletionAction({ type: "failed" })).toBe("failed")
    })

    it("lleva una sesión expirada al flujo de renovación", () => {
        expect(diditCompletionAction({
            type: "failed",
            error: { type: "sessionExpired", message: "expired" },
        })).toBe("expired")
    })
})
