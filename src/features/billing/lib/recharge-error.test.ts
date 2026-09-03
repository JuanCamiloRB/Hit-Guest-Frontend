import { describe, expect, it } from "vitest"
import { ApiError } from "@/types/api"
import { rechargeErrorDescription } from "./recharge-error"

// Envelope real observado por curl el 2026-09-03 con `{"amount": 1}`.
const MINIMO = "El monto mínimo de recarga es $10.00 USD."

describe("rechargeErrorDescription", () => {
    it("un 422 muestra el mensaje del backend TAL CUAL, no el genérico", () => {
        const error = new ApiError(422, {
            message: MINIMO,
            errors: { amount: [MINIMO] },
        })
        // "Inténtalo de nuevo" es un consejo falso para un error de validación:
        // reintentar no cambia el monto. El mensaje del servidor es la instrucción.
        expect(rechargeErrorDescription(error)).toBe(MINIMO)
    })

    it("cae al primer error de campo si el 422 llegara sin message", () => {
        const error = new ApiError(422, { message: "", errors: { amount: [MINIMO] } })
        expect(rechargeErrorDescription(error)).toBe(MINIMO)
    })

    it("todo lo demás es transitorio y conserva el genérico", () => {
        expect(rechargeErrorDescription(new ApiError(500, { message: "Server Error" })))
            .toBe("Inténtalo de nuevo en unos minutos.")
        expect(rechargeErrorDescription(new TypeError("Failed to fetch")))
            .toBe("Inténtalo de nuevo en unos minutos.")
        // Un 422 sin nada legible tampoco puede mostrar un mensaje vacío.
        expect(rechargeErrorDescription(new ApiError(422, { message: "" })))
            .toBe("Inténtalo de nuevo en unos minutos.")
    })
})
