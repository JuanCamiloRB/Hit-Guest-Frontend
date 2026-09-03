import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ContractScreen } from "./ContractScreen"

const mocks = vi.hoisted(() => {
    const push = vi.fn()
    const replace = vi.fn()
    return ({
    push,
    replace,
    router: { push, replace },
    getPortal: vi.fn(),
    getContractPreview: vi.fn(),
    signMainGuest: vi.fn(),
    completeMainGuest: vi.fn(),
    completeSecondaryGuest: vi.fn(),
    checkVerificationResult: vi.fn(),
    loadSession: vi.fn(),
    expireVerificationSession: vi.fn(),
    isMainGuest: true,
})})

vi.mock("next/navigation", () => ({
    useRouter: () => mocks.router,
    useSearchParams: () => new URLSearchParams("guest_uuid=guest-1"),
}))

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        getPortal: mocks.getPortal,
        getContractPreview: mocks.getContractPreview,
        signMainGuest: mocks.signMainGuest,
        completeMainGuest: mocks.completeMainGuest,
        completeSecondaryGuest: mocks.completeSecondaryGuest,
        checkVerificationResult: mocks.checkVerificationResult,
    },
}))

vi.mock("@/features/checkin/hooks/useIdentifySession", () => ({
    useIdentifySession: () => ({ load: mocks.loadSession }),
}))

vi.mock("@/features/checkin/hooks/useVerificationRecovery", () => ({
    useVerificationRecovery: () => mocks.expireVerificationSession,
}))

vi.mock("@/features/checkin/components/SignaturePad", () => ({
    SignaturePad: ({ onSignatureChange }: { onSignatureChange: (value: string) => void }) => (
        <button type="button" onClick={() => onSignatureChange(`data:image/png;base64,${"a".repeat(120)}`)}>
            Dibujar firma de prueba
        </button>
    ),
}))

vi.mock("@/features/checkin/components/GuaranteeCardForm", () => ({
    // Doble con una sola perilla: permite que un test lleve la tarjeta a
    // "active" (el único status que reabre el cierre fijo de la pantalla).
    GuaranteeCardForm: ({ onStatusChange }: { onStatusChange: (s: "active") => void }) => (
        <button type="button" onClick={() => onStatusChange("active")}>
            Simular tarjeta activa
        </button>
    ),
}))

function portal(contractStatus: "not_started" | "signed" = "not_started", completed = false) {
    return {
        reservation: { totalGuestsAllowed: 1 },
        progress: { registered: 1, completed: completed ? 1 : 0, isFullyCompleted: completed },
        registeredGuests: [{
            uuid: "guest-1",
            isMain: true,
            isCompleted: completed,
            verification: { status: "pending", currentStep: "verification" },
        }],
        documents: [],
        contract: {
            signingProvider: "hitguest_signature",
            status: contractStatus,
            hasNativeSignature: contractStatus === "signed",
            signedAt: contractStatus === "signed" ? "2026-08-14T00:00:00Z" : null,
            signedContractUrl: null,
        },
    }
}

function identityError() {
    return Object.assign(new Error("Guest identity has not been verified."), { status: 403 })
}

describe("ContractScreen — firma nativa no idempotente", () => {
    beforeEach(() => {
        // Several cases intentionally leave a default implementation after a
        // sequence of one-off responses. Reset implementations too, otherwise a
        // contract state from one test leaks into the next one.
        vi.resetAllMocks()
        mocks.isMainGuest = true
        mocks.loadSession.mockImplementation(() => ({ isMainGuest: mocks.isMainGuest }))
        localStorage.clear()
        sessionStorage.clear()
        localStorage.setItem("checkin-guest-form-reservation-1", JSON.stringify({
            email: "ada@example.com",
            name: "Ada",
            lastname: "Lovelace",
            nationalityId: 1,
            dateOfBirth: "1815-12-10",
        }))
        mocks.getContractPreview.mockResolvedValue({
            providerSlug: "hitguest_signature",
            agreement: { uuid: "doc-1", rendered: "<p>Contrato</p>" },
            guarantee: null,
        })
        mocks.signMainGuest.mockResolvedValue({ attempt: 1 })
        mocks.checkVerificationResult.mockResolvedValue({ status: "verified" })
    })

    afterEach(() => vi.useRealTimers())

    it("si sign responde 200 y complete necesita esperar, reintenta solo complete", async () => {
        mocks.getPortal
            .mockResolvedValueOnce(portal())
            .mockResolvedValueOnce(portal())
            .mockResolvedValue(portal("signed", true))
        mocks.completeMainGuest
            .mockRejectedValueOnce(identityError())
            .mockResolvedValueOnce({ message: "Main guest checkin completed." })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        expect(await screen.findByText("Documentos y Firma")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "Dibujar firma de prueba" }))
        fireEvent.click(screen.getByRole("checkbox"))
        vi.useFakeTimers()
        fireEvent.click(screen.getByRole("button", { name: "Firmar y Completar" }))

        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3_000)
            await Promise.resolve()
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(mocks.completeMainGuest).toHaveBeenCalledTimes(2)
        expect(mocks.signMainGuest).toHaveBeenCalledTimes(1)
    })

    it("reanuda status signed sin pedir ni enviar otra firma", async () => {
        mocks.getPortal.mockImplementation(() => Promise.resolve(
            mocks.completeMainGuest.mock.calls.length > 0
                ? portal("signed", true)
                : portal("signed"),
        ))
        mocks.completeMainGuest.mockResolvedValue({ message: "Main guest checkin completed." })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)

        expect(await screen.findByText("Firma guardada correctamente")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Dibujar firma de prueba" })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Finalizar check-in" }))

        await waitFor(() => expect(mocks.completeMainGuest).toHaveBeenCalledOnce())
        expect(mocks.signMainGuest).not.toHaveBeenCalled()
    })

    it("pending_signature no marca al titular completo ni desbloquea acompañantes", async () => {
        const externalPortal = {
            ...portal(),
            contract: {
                signingProvider: "tufirma",
                status: "not_started",
                hasNativeSignature: false,
                signedAt: null,
                signedContractUrl: null,
            },
        }
        // React StrictMode may load the initial portal twice. Keep both reads in
        // not_started; pending_signature comes authoritatively from the POST.
        mocks.getPortal.mockResolvedValue(externalPortal)
        mocks.getContractPreview.mockResolvedValue({
            providerSlug: "tufirma",
            agreement: { uuid: "doc-1", rendered: "<p>Contrato</p>" },
            guarantee: null,
        })
        mocks.completeMainGuest.mockResolvedValue({
            message: "Your contract has been sent for signature.",
            status: "pending_signature",
        })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)

        expect(await screen.findByText("Documentos del Contrato")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByRole("button", { name: "Aceptar y Completar" }))

        await waitFor(() => expect(mocks.push).toHaveBeenCalled())
        const destination = String(mocks.push.mock.calls.at(-1)?.[0])
        expect(destination).toContain("contract_pending=1")
        expect(destination).not.toContain("main_done=true")
        expect(localStorage.getItem("checkin-main-done-reservation-1")).toBeNull()
    })

    it("sin signingProvider no consulta preview ni exige una aceptación inexistente", async () => {
        const noContractPortal = {
                ...portal(),
                contract: {
                    signingProvider: null,
                    status: "not_started",
                    hasNativeSignature: false,
                    signedAt: null,
                    signedContractUrl: null,
                },
            }
        mocks.getPortal.mockImplementation(() => Promise.resolve(
            mocks.completeMainGuest.mock.calls.length > 0
                ? portal("not_started", true)
                : noContractPortal,
        ))
        mocks.completeMainGuest.mockResolvedValue({ message: "Check-in completado." })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)

        expect(await screen.findByText("No se requiere firma digital para completar este registro.")).toBeInTheDocument()
        expect(mocks.getContractPreview).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: "Completar check-in" }))

        await waitFor(() => expect(mocks.completeMainGuest).toHaveBeenCalledOnce())
        expect(mocks.signMainGuest).not.toHaveBeenCalled()
    })

    it("un secundario completa por su endpoint sin firmar ni aceptar el contrato del titular", async () => {
        mocks.isMainGuest = false
        const secondaryPortal = {
            ...portal(),
            registeredGuests: [{
                uuid: "guest-1",
                isMain: false,
                isCompleted: false,
                verification: { status: "approved", currentStep: "form" },
            }],
        }
        mocks.getPortal.mockResolvedValue(secondaryPortal)
        mocks.completeSecondaryGuest.mockResolvedValue({ message: "Secondary guest checkin completed." })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)

        expect(await screen.findByText("No se requiere firma digital para completar este registro.")).toBeInTheDocument()
        expect(mocks.getContractPreview).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: "Completar check-in" }))

        await waitFor(() => expect(mocks.completeSecondaryGuest).toHaveBeenCalledOnce())
        expect(mocks.signMainGuest).not.toHaveBeenCalled()
        expect(mocks.completeMainGuest).not.toHaveBeenCalled()
    })

    it("si complete hizo commit y falla el refresh posterior, navega sin repetir el envío", async () => {
        mocks.getPortal.mockImplementation(() => (
            mocks.completeMainGuest.mock.calls.length > 0
                ? Promise.reject(new Error("network down"))
                : Promise.resolve(portal())
        ))
        mocks.completeMainGuest.mockResolvedValue({ message: "Main guest checkin completed." })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        await screen.findByText("Documentos y Firma")
        fireEvent.click(screen.getByRole("button", { name: "Dibujar firma de prueba" }))
        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByRole("button", { name: "Firmar y Completar" }))

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(
            "/checkin/reservation-1/success?guest_uuid=guest-1&main_done=true",
        ))
        expect(mocks.signMainGuest).toHaveBeenCalledOnce()
        expect(mocks.completeMainGuest).toHaveBeenCalledOnce()
    })
})

/**
 * Separación contrato → tarjeta (Didier, 2026-08-19): la pantalla mostraba el
 * bloque del contrato y el de la tarjeta a la vez, con DOS botones primarios
 * ("Continuar con confianza" y "Aceptar y Completar") compitiendo. Ahora son dos
 * fases secuenciales en la misma ruta, con un solo botón primario cada una.
 *
 * El invariante que estos tests protegen es del contrato del backend:
 * `/main/complete` NUNCA se llama antes de que la tarjeta esté `active`, porque
 * el backend lo rechaza con 422 ("A guarantee card must be registered before
 * completing check-in").
 */
describe("ContractScreen — fases contrato → tarjeta cuando hay garantía", () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mocks.isMainGuest = true
        mocks.loadSession.mockImplementation(() => ({ isMainGuest: mocks.isMainGuest }))
        localStorage.clear()
        sessionStorage.clear()
        localStorage.setItem("checkin-guest-form-reservation-1", JSON.stringify({
            email: "ada@example.com",
            name: "Ada",
            lastname: "Lovelace",
            nationalityId: 1,
            dateOfBirth: "1815-12-10",
        }))
        mocks.signMainGuest.mockResolvedValue({ attempt: 1 })
        mocks.completeMainGuest.mockResolvedValue({ message: "Main guest checkin completed." })
        // Con garantía: `/contract/preview` la devuelve renderizada.
        mocks.getContractPreview.mockResolvedValue({
            providerSlug: "hitguest_signature",
            agreement: { uuid: "doc-1", rendered: "<p>Contrato</p>" },
            guarantee: { rendered: "<p>Garantía</p>" },
        })
    })

    it("FASE 1: firma y avanza a la tarjeta SIN llamar a complete", async () => {
        mocks.getPortal.mockResolvedValue(portal())

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        await screen.findByText("Documentos y Firma")

        fireEvent.click(screen.getByRole("button", { name: "Dibujar firma de prueba" }))
        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByRole("button", { name: "Firmar y continuar" }))

        // Pasa a la fase de la tarjeta…
        expect(await screen.findByText("Tarjeta de garantía")).toBeInTheDocument()
        expect(screen.getByText("Contrato firmado")).toBeInTheDocument()
        // …con la firma ya enviada…
        expect(mocks.signMainGuest).toHaveBeenCalledOnce()
        // …y sin haber tocado complete: el backend lo rechazaría con 422.
        expect(mocks.completeMainGuest).not.toHaveBeenCalled()
    })

    it("FASE 2: el cierre fijo NO está en pantalla hasta que la tarjeta esté activa", async () => {
        // Dos CTAs a la vez (reporte de Didier, 2026-09-04): el sub-paso de la
        // garantía trae su propio botón, y el "Completar check-in" fijo —más
        // grande y más cerca del pulgar— quedaba deshabilitado debajo. El 95%
        // tocaba el muerto. Ahora el cierre se RETIRA durante el sub-paso.
        mocks.getPortal.mockResolvedValue(portal())

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        await screen.findByText("Documentos y Firma")
        fireEvent.click(screen.getByRole("button", { name: "Dibujar firma de prueba" }))
        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByRole("button", { name: "Firmar y continuar" }))

        await screen.findByText("Tarjeta de garantía")
        expect(screen.queryByRole("button", { name: "Completar check-in" })).not.toBeInTheDocument()
        expect(mocks.completeMainGuest).not.toHaveBeenCalled()

        // La tarjeta queda activa → el cierre reaparece como ÚNICO primario, ya
        // habilitado, y sigue sin llamar a complete hasta que el huésped lo toque.
        fireEvent.click(screen.getByRole("button", { name: "Simular tarjeta activa" }))
        const finalizar = await screen.findByRole("button", { name: "Completar check-in" })
        expect(finalizar).toBeEnabled()
        expect(mocks.completeMainGuest).not.toHaveBeenCalled()
    })

    it("un solo botón primario por fase: la tarjeta no aparece junto al contrato", async () => {
        mocks.getPortal.mockResolvedValue(portal())

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        await screen.findByText("Documentos y Firma")

        // En FASE 1 el bloque de la tarjeta no existe todavía.
        expect(screen.queryByText("Tarjeta de garantía")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Completar check-in" })).not.toBeInTheDocument()
    })

    it("reingreso ya firmado cae directo en la tarjeta, sin volver a firmar", async () => {
        // El portal reporta la firma: la fase la deriva el backend, no un flag local.
        mocks.getPortal.mockResolvedValue(portal("signed"))

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)

        expect(await screen.findByText("Tarjeta de garantía")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Dibujar firma de prueba" })).not.toBeInTheDocument()
        expect(mocks.signMainGuest).not.toHaveBeenCalled()
    })

    it("TuFirma: acepta y pasa a la tarjeta sin firmar nada", async () => {
        const externalPortal = {
            ...portal(),
            contract: {
                signingProvider: "tufirma",
                status: "not_started",
                hasNativeSignature: false,
                signedAt: null,
                signedContractUrl: null,
            },
        }
        mocks.getPortal.mockResolvedValue(externalPortal)
        mocks.getContractPreview.mockResolvedValue({
            providerSlug: "tufirma",
            agreement: { uuid: "doc-1", rendered: "<p>Contrato</p>" },
            guarantee: { rendered: "<p>Garantía</p>" },
        })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        await screen.findByText("Documentos del Contrato")

        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByRole("button", { name: "Aceptar y continuar" }))

        expect(await screen.findByText("Tarjeta de garantía")).toBeInTheDocument()
        expect(screen.getByText("Contrato aceptado")).toBeInTheDocument()
        // TuFirma firma por correo: este endpoint no se toca desde el portal.
        expect(mocks.signMainGuest).not.toHaveBeenCalled()
        expect(mocks.completeMainGuest).not.toHaveBeenCalled()
    })

    it("sin garantía nada cambia: un solo paso que firma y completa", async () => {
        mocks.getPortal.mockResolvedValue(portal())
        mocks.getContractPreview.mockResolvedValue({
            providerSlug: "hitguest_signature",
            agreement: { uuid: "doc-1", rendered: "<p>Contrato</p>" },
            guarantee: null,
        })

        render(<ContractScreen reservationUuid="reservation-1" basePath="/checkin/reservation-1" />)
        await screen.findByText("Documentos y Firma")
        fireEvent.click(screen.getByRole("button", { name: "Dibujar firma de prueba" }))
        fireEvent.click(screen.getByRole("checkbox"))
        fireEvent.click(screen.getByRole("button", { name: "Firmar y Completar" }))

        await waitFor(() => expect(mocks.completeMainGuest).toHaveBeenCalledOnce())
        expect(mocks.signMainGuest).toHaveBeenCalledOnce()
        expect(screen.queryByText("Tarjeta de garantía")).not.toBeInTheDocument()
    })
})
