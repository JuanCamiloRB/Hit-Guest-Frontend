import { describe, expect, it } from "vitest"
import type { RegisteredGuest } from "../types/checkin"
import {
    buildCompletedCheckinHref,
    completedEntryCopy,
    resolveCompletedEntryReason,
} from "./success-entry"

const guests = (isCompleted: boolean): RegisteredGuest[] => [{
    uuid: "guest-1",
    name: "Ada",
    lastname: "Lovelace",
    isMain: true,
    isCompleted,
}]

describe("success entry context", () => {
    it("preserva que /identify encontró el mismo documento con check-in completo", () => {
        expect(buildCompletedCheckinHref(
            "/checkin/reservation",
            "guest-1",
            "identity_already_completed",
        )).toBe(
            "/checkin/reservation/success?guest_uuid=guest-1&entry=identity_already_completed",
        )
    })

    it("solo acepta el contexto si el portal confirma al mismo huésped como completado", () => {
        expect(resolveCompletedEntryReason(
            "identity_already_completed",
            "guest-1",
            guests(true),
        )).toBe("identity_already_completed")
        expect(resolveCompletedEntryReason(
            "identity_already_completed",
            "guest-1",
            guests(false),
        )).toBeNull()
        expect(resolveCompletedEntryReason(
            "identity_already_completed",
            "another-guest",
            guests(true),
        )).toBeNull()
    })

    it("rechaza valores inventados en la query", () => {
        expect(resolveCompletedEntryReason("success", "guest-1", guests(true))).toBeNull()
    })

    it("hace del documento ya registrado el mensaje principal", () => {
        expect(completedEntryCopy("identity_already_completed")).toEqual({
            title: "Este check-in ya estaba completado",
            description: "El tipo y número de documento que ingresaste ya están registrados en esta reserva. No necesitas repetir el proceso.",
        })
    })
})
