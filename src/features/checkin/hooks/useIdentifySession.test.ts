import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import type { IdentifyResponse } from "../types/checkin"
import { useIdentifySession } from "./useIdentifySession"

const response = (guestUuid: string, verification: IdentifyResponse["verification"]): IdentifyResponse => ({
    guest: { uuid: guestUuid, name: "Ada", lastname: "Lovelace" },
    reservationGuest: { isMainGuest: true, isCheckinCompleted: false },
    verification,
    formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
})

describe("useIdentifySession", () => {
    beforeEach(() => localStorage.clear())

    it("no entrega a un huésped la sesión genérica de otro huésped/proveedor", () => {
        const { result } = renderHook(() => useIdentifySession("reservation"))

        act(() => result.current.save(response("guest-a", { type: "document_upload" })))

        expect(result.current.load("guest-b")).toBeNull()
        expect(result.current.load("guest-a")?.verification.type).toBe("document_upload")
    })

    it("conserva el fallback compatible si pertenece al mismo huésped", () => {
        const { result } = renderHook(() => useIdentifySession("reservation"))
        act(() => result.current.save(response("guest-a", {
            type: "session",
            sessionType: "biometric",
            url: "https://verify.didit.me/session",
        })))
        localStorage.removeItem("checkin-identify-reservation-guest-a")

        expect(result.current.load("guest-a")?.verification.type).toBe("session")
    })
})
