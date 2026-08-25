import { describe, expect, it } from "vitest"
import { findRecoverableGuest } from "./identify-recovery"
import type { RegisteredGuest } from "../types/checkin"

const guests: RegisteredGuest[] = [
    { uuid: "main", name: "Ana", lastname: "Pérez", isMain: true, isCompleted: false },
    { uuid: "secondary-a", name: "Juan", lastname: "Ruiz", isMain: false, isCompleted: false },
    { uuid: "secondary-b", name: "Juan", lastname: "Ruiz", isMain: false, isCompleted: true },
]

describe("findRecoverableGuest", () => {
    it("recovers the contractually unique main guest", () => {
        expect(findRecoverableGuest(guests, true)?.uuid).toBe("main")
    })

    it("recovers a secondary only by the backend-provided UUID", () => {
        expect(findRecoverableGuest(guests, false, "secondary-b")?.uuid).toBe("secondary-b")
    })

    it("never guesses a secondary when no UUID is available", () => {
        expect(findRecoverableGuest(guests, false)).toBeUndefined()
    })

    it("does not let a secondary route resume the main guest", () => {
        expect(findRecoverableGuest(guests, false, "main")).toBeUndefined()
    })
})
