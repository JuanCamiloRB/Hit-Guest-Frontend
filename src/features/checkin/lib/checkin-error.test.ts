import { describe, expect, it } from "vitest"
import { normalizeFailedFields, readUploadVerification } from "./checkin-error"

describe("normalizeFailedFields — dos contratos, una forma interna", () => {
    it("los lados como strings (captura 2026-09-27) quedan como campo sin motivo", () => {
        expect(normalizeFailedFields(["front", "back"])).toEqual([
            { field: "front", reason: null },
            { field: "back", reason: null },
        ])
    })

    it("los objetos del OCR conservan motivo y confianza", () => {
        expect(normalizeFailedFields([{ field: "dateOfBirth", reason: "UNCLEAR", confidence: 0.4 }]))
            .toEqual([{ field: "dateOfBirth", reason: "UNCLEAR", confidence: 0.4 }])
    })

    it("descarta lo que no es un campo y no revienta con basura", () => {
        expect(normalizeFailedFields(undefined)).toEqual([])
        expect(normalizeFailedFields("front")).toEqual([])
        expect(normalizeFailedFields([3, null, "", { reason: "x" }])).toEqual([])
    })
})

describe("readUploadVerification — bloque verification de la subida OCR (2026-10-03)", () => {
    it("lee canRetry, intentos y motivo, en camelCase o snake_case", () => {
        expect(readUploadVerification({ canRetry: true, attemptsRemaining: 1, failureReason: "document_image_quality" }))
            .toEqual({ canRetry: true, attemptsRemaining: 1, failureReason: "document_image_quality" })
        expect(readUploadVerification({ can_retry: false, attempts_remaining: 0, failure_reason: null }))
            .toEqual({ canRetry: false, attemptsRemaining: 0, failureReason: null })
    })

    it("un tipo equivocado no entra, y sin bloque no inventa uno", () => {
        expect(readUploadVerification({ canRetry: "false", attemptsRemaining: "2" })).toBeUndefined()
        expect(readUploadVerification(undefined)).toBeUndefined()
        expect(readUploadVerification([])).toBeUndefined()
    })
})
