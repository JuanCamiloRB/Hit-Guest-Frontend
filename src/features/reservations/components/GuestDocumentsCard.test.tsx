import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { EMPTY_IDENTITY_DOCUMENT } from "../lib/identity-document"
import { EMPTY_VERIFICATION_SIGNALS } from "../lib/guest-verification"
import type { ReservationGuest } from "../services/reservations-service"

const getGuests = vi.hoisted(() => vi.fn())
const resetGuestVerification = vi.hoisted(() => vi.fn())
const waiveGuestVerification = vi.hoisted(() => vi.fn())
const revokeGuestVerificationWaiver = vi.hoisted(() => vi.fn())

vi.mock("../services/reservations-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/reservations-service")>()
    return {
        ...actual,
        reservationsService: {
            getGuests,
            resetGuestVerification,
            waiveGuestVerification,
            revokeGuestVerificationWaiver,
        },
    }
})

/** Quién mira la ficha: el árbol de acciones distingue dueño de staff. */
const authUser = vi.hoisted(() => ({ current: undefined as { isAccountOwner?: boolean } | undefined }))
vi.mock("@/lib/store/auth-store", () => ({
    useAuthStore: () => ({ user: authUser.current }),
}))

const toastSuccess = vi.hoisted(() => vi.fn())
const toastWarning = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({
    toast: { success: toastSuccess, warning: toastWarning, error: vi.fn(), info: vi.fn() },
}))

/**
 * `AuthenticatedImage` hace red y usa `URL.createObjectURL`, que jsdom no
 * implementa. Acá se prueba la tarjeta, no la descarga: se stubea para que el
 * `src` quede observable.
 */
vi.mock("./AuthenticatedImage", () => ({
    AuthenticatedImage: ({ src, alt }: { src: string; alt: string }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
    ),
}))

import { GuestDocumentsCard } from "./GuestDocumentsCard"

function makeGuest(overrides: Partial<ReservationGuest> = {}): ReservationGuest {
    return {
        uuid: "guest-1",
        name: "Juan Camilo",
        lastname: "Rodríguez",
        isMain: true,
        isCheckinCompleted: true,
        verificationStatus: "approved",
        identityDocument: EMPTY_IDENTITY_DOCUMENT,
        identityWaiver: null,
        verificationSignals: EMPTY_VERIFICATION_SIGNALS,
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GuestDocumentsCard — estado de identidad", () => {
    it("muestra una sola pastilla, con el tipo de verificación como atributo", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                method: "didit",
                capturedBy: "didit",
                origin: "esta-estancia",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText("Identidad verificada · avanzada")).toBeInTheDocument()
        expect(screen.queryByText(/didit/i)).not.toBeInTheDocument()
    })

    /**
     * El estado del check-in vive en la cabecera de la reserva. Repetirlo por
     * huésped daba dos pastillas verdes para dos hechos distintos y hacía leer
     * la ficha como un segundo tablero.
     */
    it("no repite el estado del check-in, que ya está en la cabecera", async () => {
        getGuests.mockResolvedValue([makeGuest({ isCheckinCompleted: true })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        await screen.findByText("Identidad verificada")

        expect(screen.queryByText(/Check-in/i)).not.toBeInTheDocument()
    })

    it("con la verificación pendiente describe el estado y no inventa un tipo", async () => {
        getGuests.mockResolvedValue([makeGuest({
            verificationStatus: "in_review",
            identityDocument: { ...EMPTY_IDENTITY_DOCUMENT, method: "didit", isReported: true },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText("Identidad en revisión")).toBeInTheDocument()
        expect(screen.queryByText(/avanzada/i)).not.toBeInTheDocument()
    })
})

describe("GuestDocumentsCard — procedencia del documento", () => {
    it("nombra el camino del huésped recurrente sin llamarlo verificación documental", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                method: "otp",
                capturedBy: "didit",
                origin: "otra-estancia",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText("Identidad verificada · por código")).toBeInTheDocument()
    })

    it("avisa en el modal que la foto es de otra estancia, con quién la capturó", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                method: "otp",
                capturedBy: "didit",
                capturedAt: "2026-07-02 14:31:08",
                origin: "otra-estancia",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        // El aviso vive en el modal: en la lista no debe aparecer todavía.
        expect(screen.queryByText(/estancia anterior/i)).not.toBeInTheDocument()

        fireEvent.click(await screen.findByRole("button", { name: /Frente/i }))

        const aviso = await screen.findByText(/estancia anterior/i)
        expect(aviso).toHaveTextContent("Didit")
    })

    it("no avisa nada cuando el documento es de esta misma reserva", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                method: "didit",
                capturedBy: "didit",
                origin: "esta-estancia",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        fireEvent.click(await screen.findByRole("button", { name: /Frente/i }))

        expect(screen.queryByText(/estancia anterior/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/No se pudo determinar/i)).not.toBeInTheDocument()
    })

    it("avisa cuando el origen es indeterminable, en vez de callarlo", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                origin: "desconocido",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        fireEvent.click(await screen.findByRole("button", { name: /Frente/i }))

        expect(await screen.findByText(/No se pudo determinar/i)).toBeInTheDocument()
    })
})

describe("GuestDocumentsCard — estados vacíos", () => {
    it("explica que el proveedor conserva la evidencia cuando el backend lo reportó", async () => {
        getGuests.mockResolvedValue([makeGuest({
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                method: "didit",
                capturedBy: "didit",
                origin: "otra-estancia",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText(/Verificación avanzada: el proveedor conserva la evidencia/i))
            .toBeInTheDocument()
    })

    it("no afirma nada sobre el documento cuando no se pudo preguntar", async () => {
        getGuests.mockResolvedValue([makeGuest({ identityDocument: EMPTY_IDENTITY_DOCUMENT })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText("Identidad verificada; imágenes no disponibles")).toBeInTheDocument()
    })

    it("muestra las dos caras cuando existen, y solo una cuando el reverso no está", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            documentImage2: null,
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                isReported: true,
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByRole("button", { name: /Frente/i })).toBeInTheDocument()
        // Un documento de una sola cara es normal: no debe quedar un hueco roto.
        expect(screen.queryByRole("button", { name: /Reverso/i })).not.toBeInTheDocument()
    })
})

/** Contrato 2026-09-08/15 — exoneración, señales del panel y expediente perdido. */
describe("GuestDocumentsCard — override del PM sobre la verificación", () => {
    beforeEach(() => {
        authUser.current = undefined
    })

    const rejectedNoRetry = {
        reported: true,
        status: "rejected",
        currentStep: "rejected",
        isStale: false,
        canRetry: false,
        attemptsRemaining: 0,
        failureReason: "document_unreadable",
    } as const

    it("un exonerado NUNCA se muestra como verificado (QA 3), y el aviso nombra quién autorizó", async () => {
        getGuests.mockResolvedValue([makeGuest({
            isCheckinCompleted: false,
            verificationStatus: "waived",
            identityWaiver: {
                uuid: "w-1",
                reason: "Documento ilegible; identidad confirmada en persona.",
                grantedAt: "2026-09-08T20:14:33.000000Z",
                grantedBy: "Ricardo Lombana",
            },
            verificationSignals: { ...EMPTY_VERIFICATION_SIGNALS, reported: true, status: "waived" },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText("Verificación exonerada")).toBeInTheDocument()
        expect(screen.getByText(/por Ricardo Lombana/)).toBeInTheDocument()
        expect(screen.getByText(/Motivo: Documento ilegible/)).toBeInTheDocument()
        expect(screen.queryByText(/Identidad verificada/)).not.toBeInTheDocument()
    })

    it("staff ve QUE hay exoneración pero no el motivo (reason null es el caso normal, QA 9)", async () => {
        getGuests.mockResolvedValue([makeGuest({
            isCheckinCompleted: false,
            verificationStatus: "waived",
            identityWaiver: { uuid: "w-1", reason: null, grantedAt: null, grantedBy: "Dueño" },
            verificationSignals: { ...EMPTY_VERIFICATION_SIGNALS, reported: true, status: "waived" },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)

        expect(await screen.findByText("Verificación exonerada")).toBeInTheDocument()
        expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument()
    })

    it("rechazado sin intentos: el dueño ve Reiniciar y Exonerar; staff solo Reiniciar (QA 4)", async () => {
        authUser.current = { isAccountOwner: true }
        getGuests.mockResolvedValue([makeGuest({
            isCheckinCompleted: false,
            verificationStatus: "rejected",
            verificationSignals: rejectedNoRetry,
        })])

        const { unmount } = render(<GuestDocumentsCard reservationUuid="res-1" />)
        expect(await screen.findByRole("button", { name: /Reiniciar verificación/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Exonerar verificación/ })).toBeInTheDocument()
        unmount()

        authUser.current = { isAccountOwner: false }
        render(<GuestDocumentsCard reservationUuid="res-1" />)
        expect(await screen.findByRole("button", { name: /Reiniciar verificación/ })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Exonerar verificación/ })).not.toBeInTheDocument()
    })

    it("Reiniciar llama al endpoint con reserva y huésped, y refresca la ficha", async () => {
        resetGuestVerification.mockResolvedValue("La verificación se reinició.")
        getGuests.mockResolvedValue([makeGuest({
            uuid: "guest-9",
            isCheckinCompleted: false,
            verificationStatus: "rejected",
            verificationSignals: rejectedNoRetry,
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        fireEvent.click(await screen.findByRole("button", { name: /Reiniciar verificación/ }))

        await screen.findByRole("button", { name: /Reiniciar verificación/ })
        expect(resetGuestVerification).toHaveBeenCalledWith("res-1", "guest-9")
        // El estado del huésped cambió en el backend: la ficha se vuelve a pedir.
        expect(getGuests.mock.calls.length).toBeGreaterThan(1)
    })

    it("si la acción se aplica pero la ficha no recarga, se dice — no se deja estado viejo con cara de éxito", async () => {
        resetGuestVerification.mockResolvedValue("La verificación se reinició.")
        getGuests
            .mockResolvedValueOnce([makeGuest({
                uuid: "guest-9",
                isCheckinCompleted: false,
                verificationStatus: "rejected",
                verificationSignals: rejectedNoRetry,
            })])
            .mockRejectedValueOnce(new Error("red caída"))

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        fireEvent.click(await screen.findByRole("button", { name: /Reiniciar verificación/ }))

        await waitFor(() => expect(toastWarning).toHaveBeenCalledWith(expect.stringContaining("no pudimos recargar")))
        // La mutación SÍ ocurrió: el éxito no se oculta, se matiza.
        expect(toastSuccess).toHaveBeenCalledWith("La verificación se reinició.")
    })

    it("con backend anterior (sin bloque verification) no aparece ninguna acción", async () => {
        authUser.current = { isAccountOwner: true }
        getGuests.mockResolvedValue([makeGuest({
            isCheckinCompleted: false,
            verificationStatus: "rejected",
            verificationSignals: EMPTY_VERIFICATION_SIGNALS,
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        expect(await screen.findByText("Verificación con incidencia")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Reiniciar verificación/ })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Exonerar/ })).not.toBeInTheDocument()
    })

    it("una imagen PERDIDA avisa expediente incompleto; un documento sin reverso no alarma (QA 11)", async () => {
        getGuests.mockResolvedValue([makeGuest({
            documentImage1: "https://api/front",
            identityDocument: {
                ...EMPTY_IDENTITY_DOCUMENT,
                front: "https://api/front",
                isReported: true,
                imageFailures: {
                    front: null,
                    back: { flow: "didit", reason: "download failed with HTTP 403", at: "2026-09-08T20:00:00Z" },
                },
            },
        })])

        render(<GuestDocumentsCard reservationUuid="res-1" />)
        expect(await screen.findByText(/Expediente incompleto/)).toBeInTheDocument()
        expect(screen.getByText(/reverso/)).toBeInTheDocument()
    })
})
