import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReservationDetailData } from "../services/reservations-service"
import { readCheckinLinkDelivery } from "../lib/checkin-link-delivery-status"
import { readReservationOrigin } from "../lib/reservation-origin"

const mocks = vi.hoisted(() => ({ getById: vi.fn() }))

vi.mock("../services/reservations-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/reservations-service")>()),
    reservationsService: { getById: mocks.getById },
}))
// Los hijos cargan sus propios datos; aquí se prueba solo cómo el panel usa la ficha.
vi.mock("./automations", () => ({ AutomationStatusList: () => null }))
vi.mock("./GuestDocumentsCard", () => ({ GuestDocumentsCard: () => null }))
vi.mock("./PropertyDocumentsCard", () => ({ PropertyDocumentsCard: () => null }))
vi.mock("./CheckinLinkDeliveryCard", () => ({ CheckinLinkDeliveryCard: () => null }))
vi.mock("./ReservationDialog", () => ({ ReservationDialog: () => null }))
vi.mock("./RegisterPriceDialog", () => ({ RegisterPriceDialog: () => null }))
vi.mock("../hooks/useCheckinLinkChannels", () => ({
    useCheckinLinkChannels: () => ({ channels: ["email"], resolved: false, unitCosts: { whatsapp: null, ota_inbox: null } }),
}))

import { detailCacheFor, prefetchReservationDetail, resetReservationDetailCache } from "../lib/reservation-detail-cache"
import { OperationsPanel } from "./OperationsPanel"

function detail(guestName: string): ReservationDetailData {
    return {
        uuid: "r1",
        guestName,
        email: "ana@example.com",
        phone: "+573001112233",
        propertyName: "Pullman",
        unitName: "Suite 101",
        checkIn: new Date(2026, 10, 13),
        checkOut: new Date(2026, 10, 15),
        nights: 2,
        status: "CONFIRMED",
        statusLabel: "Confirmada",
        statusId: 27,
        source: "Airbnb",
        totalPrice: 350000,
        currency: "COP",
        totalGuests: 2,
        externalId: "MANUAL-001",
        origin: readReservationOrigin({}),
        capacityDeclarationRequired: false,
        priceUnconfirmed: false,
        priceDeclaredByGuest: false,
        guestPriceDeclaration: null,
        overwrittenEdits: [],
        propertyUuid: "p1",
        listingUuid: "l1",
        listingInactiveReason: null,
        checkinLinkDelivery: readCheckinLinkDelivery({}),
        automationStatus: { link: "none", checkin: "pending", contract: "none", code: "none", tra: "none", sireIn: "none", sireOut: "none" },
    }
}

const skeleton = () => screen.queryByText("Cargando reserva…")

describe("OperationsPanel — la ficha desde la caché", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetReservationDetailCache()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("sin precarga: esqueleto hasta que llega la ficha", async () => {
        mocks.getById.mockResolvedValue(detail("Ana García"))
        render(<OperationsPanel reservationId="r1" />)
        expect(skeleton()).toBeInTheDocument()
        expect(await screen.findByRole("heading", { level: 1, name: "Ana García" })).toBeInTheDocument()
        expect(skeleton()).toBeNull()
    })

    it("precargada: se pinta al instante, sin esqueleto, y se revalida detrás", async () => {
        mocks.getById.mockResolvedValueOnce(detail("Ana García"))
        prefetchReservationDetail("r1")
        await waitFor(() => expect(detailCacheFor("r1").read()).not.toBeNull())

        let release!: (value: ReservationDetailData) => void
        mocks.getById.mockReturnValueOnce(new Promise<ReservationDetailData>((res) => { release = res }))
        render(<OperationsPanel reservationId="r1" />)
        expect(skeleton()).toBeNull()
        expect(screen.getByRole("heading", { level: 1, name: "Ana García" })).toBeInTheDocument()

        await act(async () => release(detail("Ana García Ruiz")))
        expect(await screen.findByRole("heading", { level: 1, name: "Ana García Ruiz" })).toBeInTheDocument()
        expect(mocks.getById).toHaveBeenCalledTimes(2)
    })

    it("sin ficha y con fallo: «No pudimos cargar la reserva» con el mensaje", async () => {
        mocks.getById.mockRejectedValue(new Error("Servicio no disponible"))
        render(<OperationsPanel reservationId="r1" />)
        expect(await screen.findByText("No pudimos cargar la reserva")).toBeInTheDocument()
        expect(screen.getByText("Servicio no disponible")).toBeInTheDocument()
    })

    it("con ficha y una actualización fallida: se conserva y avisa; Reintentar vuelve a pedir", async () => {
        mocks.getById.mockResolvedValueOnce(detail("Ana García")).mockRejectedValueOnce(new Error("503"))
        render(<OperationsPanel reservationId="r1" />)
        await screen.findByRole("heading", { level: 1, name: "Ana García" })

        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        const notice = (await screen.findByText(/No pudimos actualizar la reserva/)).closest("[data-slot=feedback-banner]")
        // Aviso compartido: advertencia que aparece tras el fallo → status, sin interrumpir.
        expect(notice).toHaveAttribute("data-tone", "warning")
        expect(notice).toHaveAttribute("role", "status")
        expect(notice).toContainElement(screen.getByRole("button", { name: "Reintentar" }))
        expect(screen.getByRole("heading", { level: 1, name: "Ana García" })).toBeInTheDocument()

        mocks.getById.mockResolvedValueOnce(detail("Ana García"))
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        await waitFor(() => expect(screen.queryByText(/No pudimos actualizar la reserva/)).toBeNull())
        expect(mocks.getById).toHaveBeenCalledTimes(3)
    })

    it("editar (reservationCreated) relee la ficha sin volver al esqueleto", async () => {
        mocks.getById.mockResolvedValueOnce(detail("Ana García")).mockResolvedValueOnce(detail("Ana Editada"))
        render(<OperationsPanel reservationId="r1" />)
        await screen.findByRole("heading", { level: 1, name: "Ana García" })

        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        expect(skeleton()).toBeNull()
        expect(await screen.findByRole("heading", { level: 1, name: "Ana Editada" })).toBeInTheDocument()
    })

    it("mientras relee, la ficha sigue a la vista y lo dice con «Actualizando reserva…»", async () => {
        // Sin colas `Once` (clearAllMocks no las vacía): la primera responde, la
        // segunda espera a `finish`; al final se restaura la respuesta por defecto.
        let finish: ((value: unknown) => void) | null = null
        let calls = 0
        const previous = mocks.getById.getMockImplementation()
        mocks.getById.mockImplementation(() => {
            calls += 1
            return calls === 1 ? Promise.resolve(detail("Ana García")) : new Promise((resolve) => { finish = resolve })
        })
        render(<OperationsPanel reservationId="r1" />)
        await screen.findByRole("heading", { level: 1, name: "Ana García" })
        const indicator = document.querySelector("[data-slot=refresh-indicator]")!
        expect(indicator).toBeEmptyDOMElement()

        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        await waitFor(() => expect(indicator).toHaveTextContent("Actualizando reserva…"))
        expect(screen.getByRole("heading", { level: 1, name: "Ana García" })).toBeInTheDocument()
        expect(skeleton()).toBeNull()

        await act(async () => { finish?.(detail("Ana Editada")) })
        expect(await screen.findByRole("heading", { level: 1, name: "Ana Editada" })).toBeInTheDocument()
        expect(indicator).toBeEmptyDOMElement()
        if (previous) mocks.getById.mockImplementation(previous)
        else mocks.getById.mockReset()
    })

    it("el canal se dice tal cual: Expedia es externa, sin canal es «Origen no informado» (nunca «directa»)", async () => {
        mocks.getById.mockResolvedValueOnce({ ...detail("Ana García"), source: "Expedia", sourceSlug: "expedia" })
        const first = render(<OperationsPanel reservationId="r1" />)
        expect(await screen.findByText(/Reserva externa · Expedia/)).toBeInTheDocument()
        first.unmount()
        resetReservationDetailCache()

        mocks.getById.mockResolvedValueOnce({ ...detail("Ana García"), source: null, sourceSlug: null })
        render(<OperationsPanel reservationId="r1" />)
        expect((await screen.findAllByText(/Origen no informado/)).length).toBeGreaterThan(0)
        expect(screen.queryByText(/Reserva directa/)).toBeNull()
    })

    it("«Directo» es reserva directa y «Desconocido» no se afirma como externa", async () => {
        mocks.getById.mockResolvedValueOnce({ ...detail("Ana García"), source: "Directo", sourceSlug: "direct" })
        const first = render(<OperationsPanel reservationId="r1" />)
        expect((await screen.findAllByText(/Reserva directa/)).length).toBeGreaterThan(0)
        first.unmount()
        resetReservationDetailCache()

        mocks.getById.mockResolvedValueOnce({ ...detail("Ana García"), source: "Desconocido", sourceSlug: "unknown" })
        render(<OperationsPanel reservationId="r1" />)
        expect((await screen.findAllByText(/Origen no informado/)).length).toBeGreaterThan(0)
        expect(screen.queryByText(/Reserva externa/)).toBeNull()
    })
})
