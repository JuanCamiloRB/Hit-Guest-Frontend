import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { IdentifySessionData } from "@/features/checkin/types/checkin"
import { VerifyScreen } from "./VerifyScreen"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    uploadDocumentImages: vi.fn(),
    getPortal: vi.fn(),
    checkVerificationResult: vi.fn(),
    toastError: vi.fn(),
    startVerification: vi.fn(),
    loadSession: vi.fn(),
    saveRaw: vi.fn(),
    identificationTypes: [{ id: 5, requiresBackImage: false }],
    session: {
        guestUuid: "guest",
        guestName: "Ada",
        guestLastname: "Lovelace",
        isMainGuest: true,
        isCheckinCompleted: false,
        verification: { type: "document_upload" as const },
        formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
        timestamp: Date.now(),
        identificationTypeId: 5,
    } as IdentifySessionData,
}))

vi.mock("next/navigation", () => {
    const router = { push: mocks.push, replace: mocks.replace }
    return { useRouter: () => router }
})

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: mocks.toastError, info: vi.fn() },
}))

vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        uploadDocumentImages: mocks.uploadDocumentImages,
        getPortal: mocks.getPortal,
        checkVerificationResult: mocks.checkVerificationResult,
    },
}))

vi.mock("@/features/checkin/hooks/useIdentifySession", () => ({
    useIdentifySession: () => ({
        load: mocks.loadSession,
        saveRaw: mocks.saveRaw,
        clear: vi.fn(),
    }),
}))

vi.mock("@/features/auth/services/catalog-service", () => ({
    CatalogService: class {
        getIdentificationTypesV2() {
            return Promise.resolve(mocks.identificationTypes)
        }
    },
}))

vi.mock("@didit-protocol/sdk-web", () => ({
    DiditSdk: {
        shared: {
            isPresented: false,
            destroy: vi.fn(),
            startVerification: mocks.startVerification,
        },
    },
}))

describe("VerifyScreen — contrato síncrono de Textract", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        mocks.identificationTypes = [{ id: 5, requiresBackImage: false }]
        mocks.session.verification = { type: "document_upload" }
        mocks.loadSession.mockReturnValue(mocks.session)
        mocks.uploadDocumentImages.mockResolvedValue({
            success: true,
            extractedData: {
                name: "Ada",
                lastname: "Lovelace",
                dateOfBirth: "1815-12-10",
            },
            formSchema: { prefilledData: { identificationNumber: "DOC-1" } },
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("reloads the exact guest session when client navigation changes guest_uuid", async () => {
        const secondSession = { ...mocks.session, guestUuid: "guest-2", guestName: "Grace" }
        mocks.loadSession.mockImplementation((uuid?: string) =>
            uuid === "guest-2" ? secondSession : mocks.session,
        )

        const { rerender } = render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )
        await screen.findByText("Verifica tu Identidad")

        rerender(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest-2"
                basePath="/checkin/reservation"
            />,
        )

        await waitFor(() => expect(mocks.loadSession).toHaveBeenCalledWith("guest-2"))
    })

    it("un 200 abre la confirmación sin consultar el portal ni iniciar polling", async () => {
        const { container } = render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                isSecondary
                formStorageKey="checkin-secondary-form-token"
            />,
        )

        await screen.findByText("Verifica tu Identidad")
        const documentInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(documentInputs[0], {
            target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

        await screen.findByText("Tomar selfie")
        const selfieInput = container.querySelector<HTMLInputElement>('input[type="file"]')
        expect(selfieInput).not.toBeNull()
        fireEvent.change(selfieInput!, {
            target: { files: [new File(["selfie"], "selfie.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Analizar Documento" }))

        await screen.findByText("Confirma tus datos")
        await waitFor(() => expect(mocks.uploadDocumentImages).toHaveBeenCalledOnce())
        expect(mocks.getPortal).not.toHaveBeenCalled()
        expect(screen.getByDisplayValue("DOC-1")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
        expect(JSON.parse(localStorage.getItem("checkin-secondary-form-token") ?? "null"))
            .toMatchObject({ identificationNumber: "DOC-1" })
        expect(localStorage.getItem("checkin-guest-form-reservation")).toBeNull()
    })

    it("no permite avanzar sin reverso cuando el tipo de documento lo exige", async () => {
        mocks.identificationTypes = [{ id: 5, requiresBackImage: true }]
        const { container } = render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )

        await screen.findByText("Verifica tu Identidad")
        await screen.findByText("Foto Reverso")
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(inputs[0], {
            target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
        })

        const continueButton = screen.getByRole("button", { name: "Continuar" })
        expect(continueButton).toBeDisabled()
        expect(screen.queryByText("Tomar selfie")).not.toBeInTheDocument()
    })

    it("consulta verify/result aunque el portal todavía no incluya verification", async () => {
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/session",
        }
        mocks.getPortal.mockResolvedValue({
            registeredGuests: [{ uuid: "guest" }],
        })
        mocks.checkVerificationResult.mockResolvedValue({ status: "verified" })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => {
            await Promise.resolve()
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_000)
        })

        expect(mocks.getPortal).toHaveBeenCalledWith("reservation")
        expect(mocks.loadSession).toHaveBeenCalledWith("guest")
        expect(mocks.checkVerificationResult).toHaveBeenCalledWith(
            "reservation",
            "guest",
            "",
        )

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600)
        })
        expect(mocks.push).toHaveBeenCalledWith("/checkin/reservation/guest?guest_uuid=guest")
    })

    it("no inicia polling antes de que una sesión Didit haya sido lanzada", async () => {
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric-new",
        }

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )

        expect(await screen.findByRole("button", { name: "Iniciar Verificación Facial" }))
            .toBeInTheDocument()
        expect(mocks.checkVerificationResult).not.toHaveBeenCalled()
    })

    it("inicia KYC en el siguiente poll aunque la lectura amplia del portal siga colgada", async () => {
        vi.useFakeTimers()
        const kycUrl = "https://verification.didit.me/kyc-new"
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        // Reproduce la causa del minuto de espera: GET /checkin consume su
        // timeout mientras el endpoint ligero ya puede observar la transición.
        mocks.getPortal.mockReturnValue(new Promise(() => {}))
        mocks.checkVerificationResult
            .mockResolvedValueOnce({ status: "pending" })
            .mockResolvedValueOnce({ status: "kyc_required", kycUrl })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(mocks.checkVerificationResult).toHaveBeenCalledTimes(1)
        expect(mocks.startVerification).not.toHaveBeenCalled()

        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(mocks.checkVerificationResult).toHaveBeenCalledTimes(2)
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(mocks.startVerification).toHaveBeenCalledWith({ url: kycUrl })
        expect(mocks.saveRaw).toHaveBeenCalledWith(expect.objectContaining({
            verification: { type: "session", sessionType: "kyc", url: kycUrl },
        }))
    })

    it("no deja que una proyección vieja del portal contradiga a verify/result", async () => {
        vi.useFakeTimers()
        const kycUrl = "https://verification.didit.me/kyc-authoritative"
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        mocks.getPortal.mockResolvedValue({
            registeredGuests: [{
                uuid: "guest",
                verification: {
                    status: "rejected",
                    currentStep: "rejected",
                    sessionType: "biometric",
                    verificationUrl: null,
                },
            }],
        })
        mocks.checkVerificationResult.mockResolvedValue({ status: "kyc_required", kycUrl })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await Promise.resolve() })

        expect(mocks.startVerification).toHaveBeenCalledWith({ url: kycUrl })
        expect(mocks.toastError).not.toHaveBeenCalled()
    })

    it("detiene el polling cuando verify/result confirma un vínculo inexistente", async () => {
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        mocks.checkVerificationResult.mockRejectedValue(
            Object.assign(new Error("Guest not found."), { status: 404 }),
        )

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await Promise.resolve() })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
        await vi.waitFor(() => {
            expect(screen.getByText("Guest not found.")).toBeInTheDocument()
        })

        await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
        expect(mocks.checkVerificationResult).toHaveBeenCalledTimes(1)
    })

    it("no reprograma polling ni navega si se desmonta con una lectura en vuelo", async () => {
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        let resolveResult!: (value: { status: "verified" }) => void
        mocks.checkVerificationResult.mockReturnValue(new Promise(resolve => {
            resolveResult = resolve
        }))
        mocks.getPortal.mockReturnValue(new Promise(() => {}))

        const view = render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(mocks.checkVerificationResult).toHaveBeenCalledTimes(1)
        view.unmount()

        await act(async () => {
            resolveResult({ status: "verified" })
            await Promise.resolve()
            await vi.advanceTimersByTimeAsync(30_000)
        })

        expect(mocks.checkVerificationResult).toHaveBeenCalledTimes(1)
        expect(mocks.push).not.toHaveBeenCalled()
    })

    it("al volver en móvil no reabre la misma sesión KYC ya consumida", async () => {
        vi.useFakeTimers()
        const consumedUrl = "https://verification.didit.me/kyc-consumed"
        mocks.session.verification = {
            type: "session",
            sessionType: "kyc",
            url: consumedUrl,
        }
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation",
            guestUuid: "guest",
            basePath: "/checkin/reservation",
            step: "kyc",
            launchedUrl: consumedUrl,
            startedAt: Date.now(),
        }))
        mocks.getPortal.mockResolvedValue({
            registeredGuests: [{
                uuid: "guest",
                verification: {
                    status: "pending",
                    currentStep: "verification",
                    sessionType: "kyc",
                    verificationUrl: consumedUrl,
                },
            }],
        })
        mocks.checkVerificationResult.mockResolvedValue({
            status: "kyc_required",
            kycUrl: consumedUrl,
        })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await Promise.resolve() })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(mocks.checkVerificationResult).toHaveBeenCalled()
        expect(mocks.startVerification).not.toHaveBeenCalled()
        expect(screen.getByText("Procesando verificación...")).toBeInTheDocument()
        expect(screen.getByText("Estamos confirmando tu verificación. Mantén esta pantalla abierta.")).toHaveClass("md:hidden")
        expect(screen.getByText("Completa la verificación en la ventana abierta.")).toHaveClass("hidden", "md:inline")
    })

    it("reanuda el polling al reabrir desde el enlace original", async () => {
        vi.useFakeTimers()
        const launchedUrl = "https://verification.didit.me/kyc-launched"
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric-old",
        }
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation",
            guestUuid: "guest",
            basePath: "/checkin/reservation",
            step: "kyc",
            launchedUrl,
            startedAt: Date.now(),
        }))
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        mocks.checkVerificationResult.mockResolvedValue({ status: "pending" })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })

        expect(mocks.checkVerificationResult).toHaveBeenCalledWith("reservation", "guest", "")
        expect(mocks.startVerification).not.toHaveBeenCalled()
        expect(screen.getByText("Procesando verificación...")).toBeInTheDocument()
    })

    it("al volver en móvil usa la sesión local consumida si localStorage no conservó el pending", async () => {
        vi.useFakeTimers()
        const consumedUrl = "https://verification.didit.me/kyc-without-pending-key"
        mocks.session.verification = {
            type: "session",
            sessionType: "kyc",
            url: consumedUrl,
        }
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        mocks.checkVerificationResult.mockResolvedValue({
            status: "kyc_required",
            kycUrl: consumedUrl,
        })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(mocks.checkVerificationResult).toHaveBeenCalled()
        expect(mocks.startVerification).not.toHaveBeenCalled()
    })
})
