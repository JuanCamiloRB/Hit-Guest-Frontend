import { describe, it, expect } from "vitest"
import { classifyCompleteFailure } from "./complete-failure"

describe("classifyCompleteFailure", () => {
    describe("firma — nunca esperar", () => {
        it("clasifica el 422 de firma faltante como problema de firma, no de identidad", () => {
            // Es el caso que hace que el orden importe: viene con 422 y hablando de
            // firma. Si el estado se mirara primero caería en identidad y mandaría
            // al huésped a esperar una verificación que ya estaba bien.
            expect(classifyCompleteFailure(
                422,
                "A digital signature is required to complete the check-in. Please sign the contract before continuing.",
            )).toBe("signature")
        })

        it("gana sobre el 403 aunque el estado sugiera identidad", () => {
            expect(classifyCompleteFailure(403, "Native signature is not configured for this property."))
                .toBe("signature")
        })

        it("reconoce el mensaje en español", () => {
            expect(classifyCompleteFailure(422, "Falta la firma del contrato")).toBe("signature")
        })
    })

    describe("identidad sin confirmar", () => {
        it("clasifica el 403 de identidad", () => {
            expect(classifyCompleteFailure(403, "Guest identity has not been verified."))
                .toBe("identity_unconfirmed")
        })

        it("reconoce el código aunque el estado no sea 403", () => {
            expect(classifyCompleteFailure(422, "identity_not_verified")).toBe("identity_unconfirmed")
            expect(classifyCompleteFailure(undefined, "The guest has not been verified"))
                .toBe("identity_unconfirmed")
        })
    })

    describe("acompañante que llega antes que el titular", () => {
        // §18 usa el MISMO 403 para esto y para "identidad no verificada", pero
        // no se resuelven igual: acá no hay nada que reverificar ni que esperar,
        // depende de otra persona. Confundirlos mandaba al huésped a rehacer una
        // verificación que ya estaba bien, o le decía que el titular faltaba
        // cuando el problema era su propia identidad.
        it("lo separa del 403 de identidad", () => {
            expect(classifyCompleteFailure(403, "Main guest must complete checkin first."))
                .toBe("main_guest_pending")
        })

        it("reconoce el mensaje traducido (X-Locale: es)", () => {
            expect(classifyCompleteFailure(403, "El huésped principal debe completar el check-in primero."))
                .toBe("main_guest_pending")
        })

        it("no se lo roba al caso de identidad", () => {
            expect(classifyCompleteFailure(403, "Guest identity has not been verified."))
                .toBe("identity_unconfirmed")
        })
    })

    describe("el resto se muestra tal cual", () => {
        it("garantía faltante", () => {
            expect(classifyCompleteFailure(422, "A guarantee card must be registered before completing check-in."))
                .toBe("other")
        })

        it("routing de contrato sin configurar", () => {
            expect(classifyCompleteFailure(422, "Digital contract routing is not configured for this reservation's booking source."))
                .toBe("other")
        })

        it("check-in fuera de ventana", () => {
            expect(classifyCompleteFailure(422, "Check-in is not available for this reservation"))
                .toBe("other")
        })

        it("no revienta con mensaje vacío", () => {
            expect(classifyCompleteFailure(500, "")).toBe("other")
        })
    })
})
