import { describe, it, expect } from "vitest"
import { ApiError } from "@/types/api"
import { readInactiveResourceError } from "./inactive-resource"

describe("readInactiveResourceError — por `code`, nunca por el texto (contrato 2026-10-27)", () => {
    it("reconoce los dos códigos y conserva el mensaje del backend", () => {
        const listing = new ApiError(422, {
            message: "El alojamiento está inactivo. Actívalo para poder operar reservas en él.",
            errors: { listingId: ["El alojamiento está inactivo. Actívalo para poder operar reservas en él."] },
            code: "LISTING_INACTIVE",
        })
        expect(readInactiveResourceError(listing)).toEqual({
            code: "LISTING_INACTIVE", message: "El alojamiento está inactivo. Actívalo para poder operar reservas en él.",
        })
        expect(readInactiveResourceError(new ApiError(422, { message: "x", code: "PROPERTY_INACTIVE" }))?.code).toBe("PROPERTY_INACTIVE")
    })

    it("sirve para el error del portal, que no es un ApiError", () => {
        const portalError = Object.assign(new Error("Esta reserva no puede procesarse…"), { status: 422, code: "LISTING_INACTIVE" })
        expect(readInactiveResourceError(portalError)).toEqual({ code: "LISTING_INACTIVE", message: "Esta reserva no puede procesarse…" })
    })

    it("un 422 que solo DICE «inactivo» en el texto no cuenta; tampoco la propuesta vieja `meta.reason`", () => {
        expect(readInactiveResourceError(new ApiError(422, { message: "El alojamiento está inactivo." }))).toBeNull()
        expect(readInactiveResourceError(new ApiError(422, { message: "x", meta: { reason: "listing_inactive" } }))).toBeNull()
    })

    it("otro estado u otro error no cuenta", () => {
        expect(readInactiveResourceError(new ApiError(403, { message: "x", code: "LISTING_INACTIVE" }))).toBeNull()
        expect(readInactiveResourceError(new Error("red"))).toBeNull()
        expect(readInactiveResourceError(null)).toBeNull()
    })
})
