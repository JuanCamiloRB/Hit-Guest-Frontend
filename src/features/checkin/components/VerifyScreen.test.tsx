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
    toastSuccess: vi.fn(),
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
    toast: { success: mocks.toastSuccess, error: mocks.toastError, info: vi.fn() },
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

describe("VerifyScreen — captura de documento sin verificación (contrato 2026-09-27)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        mocks.identificationTypes = [{ id: 5, requiresBackImage: false }]
        mocks.session.verification = { type: "document_capture", requiresBackImage: false }
        mocks.loadSession.mockReturnValue(mocks.session)
        mocks.uploadDocumentImages.mockResolvedValue({
            success: true,
            extractedData: {},
            formSchema: { prefilledData: { identificationNumber: "DOC-1" } },
        })
    })

    it("sube el frente sin selfie ni confirmación de OCR y pasa directo al formulario", async () => {
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )

        await screen.findByText("Sube tu documento")
        expect(screen.queryByText("Verifica tu Identidad")).toBeNull()
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        expect(inputs).toHaveLength(1)
        fireEvent.change(inputs[0], {
            target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Enviar fotos" }))

        await waitFor(() => expect(mocks.uploadDocumentImages).toHaveBeenCalledOnce())
        const formData = mocks.uploadDocumentImages.mock.calls[0][2] as FormData
        expect(formData.has("front_image")).toBe(true)
        expect(formData.has("selfie_image")).toBe(false)
        expect(screen.queryByText("Tomar selfie")).toBeNull()
        expect(screen.queryByText("Confirma tus datos")).toBeNull()
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/checkin/reservation/guest?guest_uuid=guest"))
        expect(JSON.parse(localStorage.getItem("checkin-guest-form-reservation") ?? "null"))
            .toMatchObject({ identificationNumber: "DOC-1" })
        expect(mocks.toastSuccess).not.toHaveBeenCalledWith("Identidad verificada exitosamente")
    })

    it("tras el 200 anota en la sesión que las fotos ya fueron aceptadas", async () => {
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )
        await screen.findByText("Sube tu documento")
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(inputs[0], { target: { files: [new File(["f"], "front.jpg", { type: "image/jpeg" })] } })
        fireEvent.click(screen.getByRole("button", { name: "Enviar fotos" }))

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/checkin/reservation/guest?guest_uuid=guest"))
        expect(mocks.saveRaw).toHaveBeenCalledWith(expect.objectContaining({ uploadOutcome: "captured" }))
    })

    it("el reverso lo decide la directiva del backend, no el catálogo de tipos de documento", async () => {
        mocks.session.verification = { type: "document_capture", requiresBackImage: true }
        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />)

        await screen.findByText("Sube tu documento")
        expect(await screen.findByText("Foto Reverso")).toBeInTheDocument()
    })

    it("GUEST_ALREADY_COMPLETED no es un fallo: lleva a la pantalla de éxito", async () => {
        mocks.uploadDocumentImages.mockRejectedValue(Object.assign(new Error("Ya completado"), {
            status: 422,
            errorType: "GUEST_ALREADY_COMPLETED",
        }))
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )

        await screen.findByText("Sube tu documento")
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(inputs[0], { target: { files: [new File(["f"], "front.jpg", { type: "image/jpeg" })] } })
        fireEvent.click(screen.getByRole("button", { name: "Enviar fotos" }))

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(
            "/checkin/reservation/success?guest_uuid=guest&entry=completion_already_recorded",
        ))
        expect(mocks.toastError).not.toHaveBeenCalled()
        expect(screen.queryByText(/no fue exitosa/i)).toBeNull()
    })

    it("DOCUMENT_NOT_DETECTED limpia solo el lado señalado en failedFields", async () => {
        mocks.session.verification = { type: "document_capture", requiresBackImage: true }
        mocks.uploadDocumentImages.mockRejectedValue(Object.assign(new Error("No document"), {
            status: 422,
            errorType: "DOCUMENT_NOT_DETECTED",
            // El servicio (mockeado acá) ya normaliza los lados a la forma interna.
            failedFields: [{ field: "back", reason: null }],
        }))
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )

        await screen.findByText("Sube tu documento")
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        expect(inputs).toHaveLength(2)
        fireEvent.change(inputs[0], { target: { files: [new File(["f"], "front.jpg", { type: "image/jpeg" })] } })
        fireEvent.change(inputs[1], { target: { files: [new File(["b"], "back.jpg", { type: "image/jpeg" })] } })
        fireEvent.click(screen.getByRole("button", { name: "Enviar fotos" }))

        await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
        expect(screen.getByText("front.jpg")).toBeInTheDocument()
        expect(screen.queryByText("back.jpg")).toBeNull()
        expect(screen.getByText(/en la foto del reverso/)).toBeInTheDocument()
        expect(mocks.push).not.toHaveBeenCalled()
    })
})

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
                dateOfBirth: "1985-12-10",
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
        expect(mocks.saveRaw).toHaveBeenCalledWith(expect.objectContaining({ uploadOutcome: "verified" }))
        expect(screen.getByDisplayValue("DOC-1")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
        expect(JSON.parse(localStorage.getItem("checkin-secondary-form-token") ?? "null"))
            .toMatchObject({ identificationNumber: "DOC-1" })
        expect(localStorage.getItem("checkin-guest-form-reservation")).toBeNull()
    })

    it("no deja confirmar una fecha de nacimiento futura recibida o editada en OCR", async () => {
        mocks.uploadDocumentImages.mockResolvedValue({
            success: true,
            extractedData: {
                name: "Ada",
                lastname: "Lovelace",
                dateOfBirth: "2999-01-01",
            },
            formSchema: { prefilledData: { identificationNumber: "DOC-1" } },
        })
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )

        await screen.findByText("Verifica tu Identidad")
        const documentInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(documentInputs[0], {
            target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
        await screen.findByText("Tomar selfie")
        const selfieInput = container.querySelector<HTMLInputElement>('input[type="file"]')
        fireEvent.change(selfieInput!, {
            target: { files: [new File(["selfie"], "selfie.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Analizar Documento" }))

        await screen.findByText("Confirma tus datos")
        expect(screen.getByRole("alert")).toHaveTextContent(/futura/)
        expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
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
        // La espera ya no es un texto congelado: arranca el guion de frases
        // (tramo 0) y la instrucción de no cerrar queda fija debajo.
        expect(screen.getByText("Conectando con el sistema de verificación…")).toBeInTheDocument()
        expect(screen.getByText("Mantén esta pantalla abierta.")).toBeInTheDocument()
        expect(screen.getByText("Conectando con el sistema de verificación…")).toBeInTheDocument()
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

    it("stale ofrece continuar la verificación: /identify es un resume idempotente (Caso A, backend 2026-09-04)", async () => {
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation",
            guestUuid: "guest",
            basePath: "/checkin/reservation",
            step: "biometric",
            launchedUrl: "https://verification.didit.me/biometric",
            startedAt: Date.now(),
        }))
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        mocks.checkVerificationResult.mockResolvedValue({ status: "stale" })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        fireEvent.click(screen.getByRole("button", { name: /Continuar verificación/ }))

        // El reset limpia el estado local y vuelve a /identify, donde el backend
        // devuelve la MISMA sesión (resume, costo cero) — nunca se relanza la URL local.
        expect(localStorage.getItem("checkin-pending-didit")).toBeNull()
        expect(mocks.replace).toHaveBeenCalledWith("/checkin/reservation/identify")
    })

    it("canRetry:false es fallo definitivo: sin botón de reintento", async () => {
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation",
            guestUuid: "guest",
            basePath: "/checkin/reservation",
            step: "biometric",
            launchedUrl: "https://verification.didit.me/biometric",
            startedAt: Date.now(),
        }))
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        mocks.checkVerificationResult.mockResolvedValue({
            status: "failed",
            retryable: false,
            failureReason: "rejected",
            attemptsRemaining: 0,
        })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(screen.getByText("Verificación no exitosa")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Repetir verificación/ })).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Volver al inicio/ })).toBeInTheDocument()
    })

    it("el fallo reparable del contrato nuevo muestra el motivo y los intentos restantes", async () => {
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "kyc",
            url: "https://verification.didit.me/kyc",
        }
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation",
            guestUuid: "guest",
            basePath: "/checkin/reservation",
            step: "kyc",
            launchedUrl: "https://verification.didit.me/kyc",
            startedAt: Date.now(),
        }))
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        // Payload real §3 del documento de backend: in_review por foto borrosa.
        mocks.checkVerificationResult.mockResolvedValue({
            status: "failed",
            retryable: true,
            failureReason: "document_image_quality",
            attemptsRemaining: 2,
        })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(screen.getByText(/borrosa o mal iluminada/)).toBeInTheDocument()
        expect(screen.getByText("Te quedan 2 intentos.")).toBeInTheDocument()

        // El reintento va por /identify (sesión nueva), jamás por la URL muerta.
        fireEvent.click(screen.getByRole("button", { name: /Repetir verificación/ }))
        expect(mocks.replace).toHaveBeenCalledWith("/checkin/reservation/identify")
        expect(mocks.startVerification).not.toHaveBeenCalled()
    })

    it("salir de la espera huérfana borra el marcador que la reanudaba (el loop de stale)", async () => {
        // El bug reportado: stale → "Volver al inicio" → reentrada → el marcador
        // `checkin-pending-didit` reanudaba el sondeo → misma espera → mismo
        // stale. El enlace debe romper el ciclo borrando el marcador local.
        vi.useFakeTimers()
        mocks.session.verification = {
            type: "session",
            sessionType: "biometric",
            url: "https://verification.didit.me/biometric",
        }
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation",
            guestUuid: "guest",
            basePath: "/checkin/reservation",
            step: "biometric",
            launchedUrl: "https://verification.didit.me/biometric",
            startedAt: Date.now(),
        }))
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
        // El backend es quien declara la espera huérfana; el front solo obedece.
        mocks.checkVerificationResult.mockResolvedValue({ status: "stale" })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        const salida = screen.getByRole("link", { name: /Volver al inicio/ })
        fireEvent.click(salida)

        expect(localStorage.getItem("checkin-pending-didit")).toBeNull()
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

/**
 * Contrato 2026-09-08, QA 3: a un huésped exonerado por el PM la UI no puede
 * decirle —en ningún lado— que su identidad se verificó. El backend nunca lo va
 * a afirmar; el portal tampoco.
 */
describe("VerifyScreen — exoneración del PM (waived)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        mocks.session.verification = { type: "session", sessionType: "biometric", url: "https://verification.didit.me/s" }
        mocks.loadSession.mockReturnValue(mocks.session)
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
    })

    it("avanza al formulario SIN el cartel de identidad verificada", async () => {
        vi.useFakeTimers()
        mocks.checkVerificationResult.mockResolvedValue({ status: "verified", waived: true })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

        expect(mocks.push).toHaveBeenCalledWith("/checkin/reservation/guest?guest_uuid=guest")
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it("un verificado DE VERDAD sí recibe su confirmación (el silencio es solo del exonerado)", async () => {
        vi.useFakeTimers()
        mocks.checkVerificationResult.mockResolvedValue({ status: "verified" })

        render(
            <VerifyScreen
                reservationUuid="reservation"
                guestUuid="guest"
                basePath="/checkin/reservation"
                fromCallback
            />,
        )

        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

        expect(mocks.toastSuccess).toHaveBeenCalledWith("Identidad verificada exitosamente")
    })
})

describe("VerifyScreen — tope de intentos en la subida OCR (contrato 2026-10-03)", () => {
    beforeEach(() => {
        // El bloque de exoneración deja temporizadores falsos activos.
        vi.useRealTimers()
        vi.clearAllMocks()
        localStorage.clear()
        mocks.identificationTypes = [{ id: 5, requiresBackImage: false }]
        mocks.session.verification = { type: "document_upload" }
        mocks.loadSession.mockReturnValue(mocks.session)
    })

    async function uploadWithSelfie() {
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )
        await screen.findByText("Verifica tu Identidad")
        const documentInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(documentInputs[0], {
            target: { files: [new File(["front"], "front.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Continuar" }))
        await screen.findByText("Tomar selfie")
        const selfieInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
        fireEvent.change(selfieInput, {
            target: { files: [new File(["selfie"], "selfie.jpg", { type: "image/jpeg" })] },
        })
        fireEvent.click(screen.getByRole("button", { name: "Analizar Documento" }))
    }

    function rejection(errorType: string, message: string, verification: Record<string, unknown>) {
        return Object.assign(new Error(message), { status: 422, errorType, verification })
    }

    it("VERIFICATION_ATTEMPTS_EXHAUSTED es definitivo y muestra el mensaje del backend", async () => {
        mocks.uploadDocumentImages.mockRejectedValue(rejection(
            "VERIFICATION_ATTEMPTS_EXHAUSTED",
            "Agotaste los intentos de verificación para esta reserva.",
            { canRetry: false, attemptsRemaining: 0 },
        ))
        await uploadWithSelfie()

        expect(await screen.findByText("Verificación no exitosa")).toBeInTheDocument()
        expect(screen.getByText("Agotaste los intentos de verificación para esta reserva.")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Repetir verificación/ })).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Volver al inicio/ })).toBeInTheDocument()
    })

    it("la última foto borrosa con canRetry:false no ofrece otra toma condenada al 422", async () => {
        mocks.uploadDocumentImages.mockRejectedValue(rejection(
            "LOW_QUALITY_IMAGE",
            "La imagen del documento es de baja calidad.",
            { canRetry: false, attemptsRemaining: 0, failureReason: "document_image_quality" },
        ))
        await uploadWithSelfie()

        expect(await screen.findByText("Verificación no exitosa")).toBeInTheDocument()
        expect(screen.getByText(/Ya no quedan intentos de verificación/)).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Repetir verificación/ })).not.toBeInTheDocument()
    })

    it("un rechazo reparable avisa cuántos intentos quedan y deja reintentar", async () => {
        mocks.uploadDocumentImages.mockRejectedValue(rejection(
            "LOW_QUALITY_IMAGE",
            "La imagen del documento es de baja calidad.",
            { canRetry: true, attemptsRemaining: 1, failureReason: "document_image_quality" },
        ))
        await uploadWithSelfie()

        await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(
            "La imagen del documento es de baja calidad.",
            { description: "Te queda 1 intento." },
        ))
        expect(screen.queryByText("Verificación no exitosa")).toBeNull()
        expect(screen.getByText("Verifica tu Identidad")).toBeInTheDocument()
    })

    it("un motivo ya definitivo no se atribuye al tope de intentos", async () => {
        mocks.uploadDocumentImages.mockRejectedValue(rejection(
            "DUPLICATE_DOCUMENT",
            "Este documento ya está registrado para otro huésped.",
            { canRetry: false, attemptsRemaining: 2, failureReason: "duplicate_document" },
        ))
        await uploadWithSelfie()

        expect(await screen.findByText("Verificación no exitosa")).toBeInTheDocument()
        expect(screen.queryByText(/Ya no quedan intentos/)).toBeNull()
    })

    it("canRetry:true reabre un motivo que la tabla local daba por definitivo", async () => {
        mocks.uploadDocumentImages.mockRejectedValue(rejection(
            "DUPLICATE_DOCUMENT",
            "Este documento ya está registrado para otro huésped.",
            { canRetry: true, attemptsRemaining: 2, failureReason: "duplicate_document" },
        ))
        await uploadWithSelfie()

        await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
        expect(screen.queryByText("Verificación no exitosa")).toBeNull()
        expect(screen.getByText("Verifica tu Identidad")).toBeInTheDocument()
    })

    it("un 413 del borde (fotos demasiado pesadas) explica qué hacer y conserva las fotos", async () => {
        // Shape real del 413 de Vercel: sin errorType ni message en la raíz, y
        // ninguna llamada llega al backend (reporte de producción 2026-10-08).
        mocks.uploadDocumentImages.mockRejectedValue(Object.assign(new Error("Error en la solicitud"), { status: 413 }))
        await uploadWithSelfie()

        await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringMatching(/pesan demasiado/)))
        expect(screen.queryByText("Verificación no exitosa")).toBeNull()
        expect(screen.getByText("front.jpg")).toBeInTheDocument()
        expect(screen.queryByText(/Error en la solicitud/)).toBeNull()
    })

    it("en captura de documento el bloque verification no cierra el reintento", async () => {
        mocks.session.verification = { type: "document_capture", requiresBackImage: false }
        mocks.uploadDocumentImages.mockRejectedValue(Object.assign(new Error("No document"), {
            status: 422,
            errorType: "DOCUMENT_NOT_DETECTED",
            failedFields: [{ field: "front", reason: null }],
            verification: { canRetry: false, attemptsRemaining: 0 },
        }))
        const { container } = render(
            <VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />,
        )
        await screen.findByText("Sube tu documento")
        const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
        fireEvent.change(inputs[0], { target: { files: [new File(["f"], "front.jpg", { type: "image/jpeg" })] } })
        fireEvent.click(screen.getByRole("button", { name: "Enviar fotos" }))

        await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
        expect(screen.queryByText("Verificación no exitosa")).toBeNull()
        expect(screen.getByText("Sube tu documento")).toBeInTheDocument()
    })
})

describe("VerifyScreen — KYC directo (contrato 2026-10-08)", () => {
    const KYC_URL = "https://verification.didit.me/kyc-direct"

    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        localStorage.clear()
        mocks.identificationTypes = [{ id: 5, requiresBackImage: false }]
        mocks.session.verification = { type: "session", sessionType: "kyc", url: KYC_URL }
        mocks.loadSession.mockReturnValue(mocks.session)
        mocks.getPortal.mockResolvedValue({ registeredGuests: [{ uuid: "guest" }] })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    function pendingMarker(step: "biometric" | "kyc", url: string) {
        localStorage.setItem("checkin-pending-didit", JSON.stringify({
            reservationUuid: "reservation", guestUuid: "guest", basePath: "/checkin/reservation",
            step, launchedUrl: url, startedAt: Date.now(),
        }))
    }

    it("un huésped nuevo entra directo a KYC: copy de documento + selfie en un solo proceso, y abre ESA url una sola vez", async () => {
        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />)

        expect(await screen.findByText(/fotografía tu documento por ambos lados/)).toBeInTheDocument()
        expect(screen.queryByText(/Solo toma un minuto/)).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Iniciar Verificación de Documento" }))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        expect(mocks.startVerification).toHaveBeenCalledTimes(1)
        expect(mocks.startVerification).toHaveBeenCalledWith({ url: KYC_URL })
        expect(JSON.parse(localStorage.getItem("checkin-pending-didit") ?? "null")).toMatchObject({ step: "kyc", launchedUrl: KYC_URL })
        expect(mocks.saveRaw).toHaveBeenCalledWith(expect.objectContaining({
            verification: { type: "session", sessionType: "kyc", url: KYC_URL },
        }))
    })

    it("un rechazo DEFINITIVO que llega por el callback se reconcilia con el backend: sin reintento y con el motivo real", async () => {
        vi.useFakeTimers()
        pendingMarker("kyc", KYC_URL)
        mocks.checkVerificationResult.mockResolvedValue({
            status: "failed", retryable: false, failureReason: "document_not_approved", attemptsRemaining: 0,
        })

        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" diditError="declined" />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(mocks.checkVerificationResult).toHaveBeenCalled()
        expect(screen.getByText("Verificación no exitosa")).toBeInTheDocument()
        expect(screen.getByText(/No pudimos validar tu documento/)).toBeInTheDocument()
        // Antes: «Tu verificación fue rechazada. Puedes intentarlo de nuevo.» — mentira con canRetry:false.
        expect(screen.queryByText(/Puedes intentarlo de nuevo/)).toBeNull()
        expect(screen.queryByRole("button", { name: /Repetir verificación/ })).not.toBeInTheDocument()
        expect(mocks.startVerification).not.toHaveBeenCalled()
    })

    it("un rechazo REPARABLE por el callback conserva canRetry, failureReason e intentos restantes", async () => {
        vi.useFakeTimers()
        pendingMarker("kyc", KYC_URL)
        mocks.checkVerificationResult.mockResolvedValue({
            status: "failed", retryable: true, failureReason: "document_image_quality", attemptsRemaining: 1,
        })

        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" diditError="declined" />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(screen.getByText(/borrosa|luz/)).toBeInTheDocument()
        expect(screen.getByText("Te queda 1 intento.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Repetir verificación/ })).toBeInTheDocument()
    })

    it("mientras el backend no confirma, muestra lo que dijo Didit como pista y no reabre la sesión consumida", async () => {
        vi.useFakeTimers()
        pendingMarker("kyc", KYC_URL)
        mocks.checkVerificationResult.mockResolvedValue({ status: "pending", verificationUrl: KYC_URL })

        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" diditError="abandoned" />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(screen.getByRole("status")).toHaveTextContent(/Didit reportó: La verificación quedó sin completar/)
        // La pista describe; no promete reintento antes de conocer `canRetry`.
        expect(screen.getByRole("status")).not.toHaveTextContent(/intent|retom/i)
        expect(mocks.checkVerificationResult).toHaveBeenCalled()
        expect(mocks.startVerification).not.toHaveBeenCalled()
        expect(screen.queryByText("Verificación no exitosa")).toBeNull()
    })

    it("sin sesión ni marcador local (otro navegador), un fallo del callback IGUAL se reconcilia con el backend", async () => {
        vi.useFakeTimers()
        mocks.loadSession.mockReturnValue(null)
        mocks.checkVerificationResult.mockResolvedValue({
            status: "failed", retryable: true, failureReason: "document_image_quality", attemptsRemaining: 2,
        })

        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" diditError="Declined" />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(mocks.checkVerificationResult).toHaveBeenCalled()
        expect(screen.getByText(/borrosa|luz/)).toBeInTheDocument()
        expect(screen.getByText("Te quedan 2 intentos.")).toBeInTheDocument()
        // Sin directiva local, reintentar vuelve a /identify (resume idempotente), no a una pantalla vacía.
        fireEvent.click(screen.getByRole("button", { name: /Repetir verificación/ }))
        expect(mocks.replace).toHaveBeenCalledWith("/checkin/reservation/identify")
    })

    it("sin sesión local, un rechazo definitivo tampoco promete reintento", async () => {
        vi.useFakeTimers()
        mocks.loadSession.mockReturnValue(null)
        mocks.checkVerificationResult.mockResolvedValue({ status: "failed", retryable: false, failureReason: "document_not_approved", attemptsRemaining: 0 })

        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" diditError="Declined" />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })

        expect(screen.getByText("Verificación no exitosa")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Repetir verificación/ })).not.toBeInTheDocument()
        expect(screen.queryByText(/Didit no aprobó la verificación\.$/)).toBeNull()
    })

    it("un huésped que Didit ya aprobó sigue entrando por biometría", async () => {
        mocks.session.verification = { type: "session", sessionType: "biometric", url: "https://verification.didit.me/bio" }
        render(<VerifyScreen reservationUuid="reservation" guestUuid="guest" basePath="/checkin/reservation" />)
        expect(await screen.findByRole("button", { name: "Iniciar Verificación Facial" })).toBeInTheDocument()
        expect(screen.getByText(/Solo toma un minuto/)).toBeInTheDocument()
    })
})
