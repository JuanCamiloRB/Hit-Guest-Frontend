import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EMPTY_IDENTITY_DOCUMENT } from "../lib/identity-document"
import type { ReservationGuest } from "../services/reservations-service"

const getGuests = vi.hoisted(() => vi.fn())

vi.mock("../services/reservations-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/reservations-service")>()
    return { ...actual, reservationsService: { getGuests } }
})

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
