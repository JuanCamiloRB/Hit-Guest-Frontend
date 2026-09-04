import { describe, expect, it } from "vitest"
import { attemptsRemainingNotice, describeVerificationFailure } from "./verification-failure-meta"

describe("describeVerificationFailure", () => {
    it("cada código del contrato 2026-09-02 tiene instrucción propia, sin nombrar el código", () => {
        expect(describeVerificationFailure("document_image_quality", true)).toMatch(/borrosa|luz/)
        expect(describeVerificationFailure("face_match_failed", true)).toMatch(/selfie/)
        expect(describeVerificationFailure("document_not_approved", true)).toMatch(/documento/)
        expect(describeVerificationFailure("manual_review", true)).toMatch(/repite el proceso/)
    })

    it("un código que no conocemos cae al genérico según el reintento — nunca el código crudo", () => {
        expect(describeVerificationFailure("some_new_backend_code", true))
            .toBe("No completaste la verificación. Vuelve a intentarlo.")
        expect(describeVerificationFailure("some_new_backend_code", false)).toMatch(/anfitrión/)
        expect(describeVerificationFailure(undefined, true)).not.toMatch(/undefined/)
    })

    it("los motivos legacy conservan su copy de siempre", () => {
        expect(describeVerificationFailure("expired", false)).toBe("Tu documento está vencido.")
        expect(describeVerificationFailure("ocr_rejected", true)).toMatch(/fotos más claras/)
    })
})

describe("attemptsRemainingNotice", () => {
    it("solo habla cuando el margen aprieta, y sin nombrar el máximo", () => {
        expect(attemptsRemainingNotice(3)).toBeNull()
        expect(attemptsRemainingNotice(undefined)).toBeNull()
        expect(attemptsRemainingNotice(2)).toBe("Te quedan 2 intentos.")
        expect(attemptsRemainingNotice(1)).toBe("Te queda 1 intento.")
        // Con 0 el backend manda canRetry:false — el aviso sobraría junto al
        // fallo definitivo.
        expect(attemptsRemainingNotice(0)).toBeNull()
    })
})
