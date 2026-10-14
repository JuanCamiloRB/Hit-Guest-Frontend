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

describe("checkinService.getReservationDocuments — reporte 2026-10-14 (4 contratos iguales)", () => {
    const portal = {
        reservation: { uuid: "r-1", arrivalDate: "2026-10-13", departureDate: "2026-10-14", totalGuestsAllowed: 2, checkinAllowed: true },
        progress: { registered: 1, completed: 0, isFullyCompleted: false },
        registeredGuests: [],
        documents: ["ag-directo", "ag-airbnb", "ag-booking", "ag-expedia"].map((uuid) => ({
            uuid, type: "Agreement", renderUrl: `/x/${uuid}/render`, pdfUrl: `/x/${uuid}/pdf`,
        })).concat([{ uuid: "rules", type: "Rules", renderUrl: "/x/rules/render", pdfUrl: "/x/rules/pdf" }]),
        contract: { signingProvider: "tufirma" as const, status: "pending", hasNativeSignature: false, signedAt: null, signedContractUrl: null },
    }

    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

    it("muestra solo el contrato que el backend eligió (contract/preview) y no renderiza los demás", async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
            if (url.endsWith("/contract/preview")) {
                return json({ data: { contractType: "agreement_only", providerSlug: "tufirma", agreement: { uuid: "ag-airbnb", rendered: "<p/>" }, guarantee: null } })
            }
            return json({ data: { rendered: "<p>doc</p>" } })
        })
        vi.stubGlobal("fetch", fetchMock)

        const docs = await checkinService.getReservationDocuments("r-1", portal as never)

        expect(docs.map((d) => d.uuid)).toEqual(["ag-airbnb", "rules"])
        const rendered = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.endsWith("/render"))
        expect(rendered).toHaveLength(2)
    })

    it("si contract/preview falla, muestra la lista sin filtrar en vez de ninguna", async () => {
        vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) =>
            url.endsWith("/contract/preview") ? json({ message: "x" }, 422) : json({ data: { rendered: "<p/>" } })))

        const docs = await checkinService.getReservationDocuments("r-1", portal as never)
        expect(docs).toHaveLength(5)
    })

    it("sin contrato digital (signingProvider null) no consulta el preview", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => json({ data: { rendered: "<p/>" } }))
        vi.stubGlobal("fetch", fetchMock)

        await checkinService.getReservationDocuments("r-1", { ...portal, contract: { ...portal.contract, signingProvider: null } } as never)
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/contract/preview"))).toBe(false)
    })
})
