import { describe, expect, it } from "vitest"
import { ApiError, toApiErrorResponse } from "./api"

describe("toApiErrorResponse — cuerpo de error de un fetch directo", () => {
    it("conserva errorType y las dos formas de failedFields", () => {
        const body = toApiErrorResponse({
            success: false, errorType: "DOCUMENT_NOT_DETECTED", message: "No hay documento.",
            failedFields: ["back", { field: "document_number", reason: "LOW_CONFIDENCE" }, 7, "otra"],
        }, "HTTP 422")
        expect(body).toEqual({
            message: "No hay documento.",
            errorType: "DOCUMENT_NOT_DETECTED",
            failedFields: ["back", { field: "document_number", reason: "LOW_CONFIDENCE" }],
        })
        expect(new ApiError(422, body).failedFields).toEqual(["back", { field: "document_number", reason: "LOW_CONFIDENCE" }])
    })

    it("sin mensaje usa el de respaldo, y descarta lo que no tiene forma", () => {
        expect(toApiErrorResponse({ errors: { backImage: ["Falta."] }, code: 5 }, "HTTP 422")).toEqual({
            message: "HTTP 422", errors: { backImage: ["Falta."] },
        })
        expect(toApiErrorResponse("no-json", "HTTP 500")).toEqual({ message: "HTTP 500" })
    })
})

describe("ApiError — `meta` (contrato 2026-10-20, `confirmUnitOverrides`)", () => {
    it("lo conserva tanto desde el cliente como desde un fetch directo", () => {
        const meta = { affectedUnits: [{ listingUuid: "u", listingName: "Casa" }] }
        expect(new ApiError(422, { message: "x", meta }).meta).toEqual(meta)
        expect(toApiErrorResponse({ message: "x", meta }, "HTTP 422").meta).toEqual(meta)
        expect(toApiErrorResponse({ message: "x", meta: null }, "HTTP 422")).not.toHaveProperty("meta")
    })
})
