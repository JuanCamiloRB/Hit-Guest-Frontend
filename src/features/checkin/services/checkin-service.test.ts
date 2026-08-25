import { afterEach, describe, expect, it, vi } from "vitest"
import { checkinService } from "./checkin-service"
import { asCheckinError } from "../lib/checkin-error"

afterEach(() => vi.unstubAllGlobals())

describe("checkinService.uploadDocumentImages", () => {
    it("preserva UNSUPPORTED_DOCUMENT_LAYOUT aunque el backend use error_type", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            message: "The given data was invalid.",
            error_type: "UNSUPPORTED_DOCUMENT_LAYOUT",
        }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
        })))

        const request = checkinService.uploadDocumentImages("reservation", "guest", new FormData())

        await expect(request).rejects.toMatchObject({
            status: 422,
            errorType: "UNSUPPORTED_DOCUMENT_LAYOUT",
        })
        await request.catch((raw) => {
            expect(asCheckinError(raw).errorType).toBe("UNSUPPORTED_DOCUMENT_LAYOUT")
        })
    })

    it("muestra el primer error de validación cuando Laravel omite message", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            errors: { back_image: ["La foto del reverso es obligatoria."] },
        }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
        })))

        await expect(
            checkinService.uploadDocumentImages("reservation", "guest", new FormData()),
        ).rejects.toMatchObject({
            status: 422,
            message: "La foto del reverso es obligatoria.",
        })
    })

    it("preserva el error OCR cuando un intermediario lo envuelve en data", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: {
                success: false,
                errorType: "UNSUPPORTED_DOCUMENT_LAYOUT",
                message: "Usa tu pasaporte.",
            },
        }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
        })))

        await expect(
            checkinService.uploadDocumentImages("reservation", "guest", new FormData()),
        ).rejects.toMatchObject({
            status: 422,
            errorType: "UNSUPPORTED_DOCUMENT_LAYOUT",
            message: "Usa tu pasaporte.",
        })
    })
})

describe("checkinService.identify", () => {
    const payload = {
        identificationTypeId: 5,
        identificationNumber: "123",
        nationalityId: 48,
        name: "Ada",
        lastname: "Lovelace",
        isMainGuest: true,
    }

    it("conserva sessionType=kyc como etapa canónica de Didit", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            guest: { uuid: "guest", name: "Ada", lastname: "Lovelace" },
            reservationGuest: { isMainGuest: true, isCheckinCompleted: false },
            verification: { type: "session", sessionType: "kyc", url: "https://didit/kyc" },
            formSchema: {},
        }), { status: 200, headers: { "Content-Type": "application/json" } })))

        await expect(checkinService.identify("reservation", payload)).resolves.toMatchObject({
            verification: { type: "session", sessionType: "kyc", url: "https://didit/kyc" },
        })
    })

    it("tolera session_type durante el despliegue sin degradarlo a biometric", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            guest: { uuid: "guest", name: "Ada", lastname: "Lovelace" },
            reservationGuest: { isMainGuest: true, isCheckinCompleted: false },
            verification: { type: "session", session_type: "kyc", url: "https://didit/kyc" },
            formSchema: {},
        }), { status: 200, headers: { "Content-Type": "application/json" } })))

        await expect(checkinService.identify("reservation", payload)).resolves.toMatchObject({
            verification: { type: "session", sessionType: "kyc", url: "https://didit/kyc" },
        })
    })
})

describe("checkinService.checkVerificationResult", () => {
    it("respeta el contrato y consulta solamente por guest_uuid", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            verification: { status: "pending", currentStep: "verification" },
        }), { status: 200, headers: { "Content-Type": "application/json" } }))
        vi.stubGlobal("fetch", fetchMock)

        await checkinService.checkVerificationResult("reservation", "guest")

        const requestedUrl = String(fetchMock.mock.calls[0]?.[0])
        expect(requestedUrl).toContain("/checkin/reservation/verify/result?guest_uuid=guest")
        expect(requestedUrl).not.toContain("session_id")
    })
})
