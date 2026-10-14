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

describe("checkinService.getReservationDocuments — pantalla final (reporte y auditoría 2026-10-14)", () => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
    const DOCUMENTS = ["ag-directo", "ag-airbnb", "ag-booking", "ag-expedia"].map((uuid) => ({
        uuid, type: "Agreement", renderUrl: `/x/${uuid}/render`, pdfUrl: `/x/${uuid}/pdf`,
    })).concat([{ uuid: "rules", type: "Rules", renderUrl: "/x/rules/render", pdfUrl: "/x/rules/pdf" }])

    /** El portal como llega a la pantalla final: titular completado, contrato con TuFirma. */
    function finalPortal(contract: Record<string, unknown>) {
        return {
            reservation: { uuid: "r-1", arrivalDate: "2026-10-13", departureDate: "2026-10-14", totalGuestsAllowed: 2, checkinAllowed: true },
            progress: { registered: 2, completed: 2, isFullyCompleted: true },
            registeredGuests: [],
            documents: DOCUMENTS,
            contract: { signingProvider: "tufirma", status: "pending", hasNativeSignature: false, signedAt: null, signedContractUrl: null, ...contract },
        }
    }

    function stubBackend(preview: () => Response) {
        const fetchMock = vi.fn().mockImplementation(async (url: string) =>
            url.endsWith("/contract/preview") ? preview() : json({ data: { rendered: "<p>doc</p>" } }))
        vi.stubGlobal("fetch", fetchMock)
        return fetchMock
    }
    const previewCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
        fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/contract/preview")).length
    const rendered = (fetchMock: ReturnType<typeof vi.fn>) =>
        fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/render")).length

    it("firma pendiente: solo el contrato que eligió el backend, sin renderizar los demás", async () => {
        const fetchMock = stubBackend(() => json({ data: { contractType: "agreement_only", providerSlug: "tufirma", agreement: { uuid: "ag-airbnb", rendered: "" }, guarantee: null } }))
        const docs = await checkinService.getReservationDocuments("r-1", finalPortal({}) as never)
        expect(docs.map((d) => d.uuid)).toEqual(["ag-airbnb", "rules"])
        expect(rendered(fetchMock)).toBe(2)
    })

    it("guarantee_only (agreement: null): ningún contrato de la propiedad", async () => {
        stubBackend(() => json({ data: { contractType: "guarantee_only", providerSlug: "tufirma", agreement: null, guarantee: { rendered: "" } } }))
        const docs = await checkinService.getReservationDocuments("r-1", finalPortal({}) as never)
        expect(docs.map((d) => d.uuid)).toEqual(["rules"])
    })

    it("preview 422 en una reserva ya cerrada: no vuelven los cuatro contratos", async () => {
        stubBackend(() => json({ message: "Check-in is not available for this reservation" }, 422))
        const docs = await checkinService.getReservationDocuments("r-1", finalPortal({}) as never)
        expect(docs.map((d) => d.uuid)).toEqual(["rules"])
    })

    it("contrato firmado disponible: no lista la copia sin firma ni consulta el preview", async () => {
        const fetchMock = stubBackend(() => json({ data: { agreement: { uuid: "ag-airbnb" } } }))
        const docs = await checkinService.getReservationDocuments("r-1", finalPortal({
            status: "completed", signedContractUrl: "/api/v1/checkin/r-1/contract/signed",
        }) as never)
        expect(docs.map((d) => d.uuid)).toEqual(["rules"])
        expect(previewCalls(fetchMock)).toBe(0)
    })

    it("sin contrato digital (signingProvider null): ni contratos ni consulta al preview", async () => {
        const fetchMock = stubBackend(() => json({}))
        const docs = await checkinService.getReservationDocuments("r-1", finalPortal({ signingProvider: null }) as never)
        expect(docs.map((d) => d.uuid)).toEqual(["rules"])
        expect(previewCalls(fetchMock)).toBe(0)
    })

    it("si el portal ya dice cuál es (contract.documentUuid), no consulta el preview", async () => {
        const fetchMock = stubBackend(() => json({}))
        const docs = await checkinService.getReservationDocuments("r-1", finalPortal({ documentUuid: "ag-booking" }) as never)
        expect(docs.map((d) => d.uuid)).toEqual(["ag-booking", "rules"])
        expect(previewCalls(fetchMock)).toBe(0)
    })
})
