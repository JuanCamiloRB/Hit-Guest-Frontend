import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { GuaranteeCardForm } from "./GuaranteeCardForm"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { loadStripe } from "@stripe/stripe-js"
import type { GuaranteeStatus } from "@/features/checkin/types/checkin"

vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        getGuaranteeStatus: vi.fn(),
        createGuaranteeSetupIntent: vi.fn(),
    },
}))

vi.mock("@stripe/stripe-js", () => ({
    loadStripe: vi.fn(),
}))

const getGuaranteeStatus = vi.mocked(checkinService.getGuaranteeStatus)
const createGuaranteeSetupIntent = vi.mocked(checkinService.createGuaranteeSetupIntent)
const loadStripeMock = vi.mocked(loadStripe)

/** Doble mínimo de Stripe.js: solo lo que este componente realmente usa. */
function stripeDouble() {
    const card = { mount: vi.fn(), on: vi.fn(), unmount: vi.fn() }
    const stripe = {
        elements: vi.fn(() => ({ create: vi.fn(() => card) })),
        confirmCardSetup: vi.fn(),
    }
    return { stripe, card }
}

function statusOf(status: GuaranteeStatus) {
    return { guarantee: { status, cardBrand: null, cardLast4: null, failureReason: null } }
}

/**
 * El payload tal como se observó en producción el 2026-08-19: el 200 traía
 * `guaranteeAmount` y `currency` (el portal llegó a renderizar «hasta USD 200»)
 * y aun así el formulario nunca se montó.
 */
function setupIntentPayload(overrides: Record<string, unknown> = {}) {
    return {
        clientSecret: "seti_123_secret_abc",
        publishableKey: "pk_test_123",
        guaranteeAmount: 200,
        currency: "USD",
        ...overrides,
    } as Awaited<ReturnType<typeof checkinService.createGuaranteeSetupIntent>>
}

function renderForm() {
    return render(
        <GuaranteeCardForm
            reservationUuid="res-1"
            guestUuid="guest-1"
            onStatusChange={() => {}}
            onSessionExpired={() => {}}
        />,
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    // Silencia los console.error deliberados del componente para que el reporte
    // de los tests no parezca una corrida rota.
    vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GuaranteeCardForm — el 200 que no alcanza para montar Stripe", () => {
    // El bug reportado por Didier: backend en 200, huésped trabado.
    it("distingue un 200 sin publishableKey en vez de mostrar el error genérico", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        createGuaranteeSetupIntent.mockResolvedValue(
            setupIntentPayload({ publishableKey: undefined }),
        )

        renderForm()

        expect(await screen.findByText(/Avisa al anfitrión para que revise la configuración de pagos/i)).toBeInTheDocument()
        expect(screen.getByText(/SETUP-PAYLOAD/)).toBeInTheDocument()
        // El texto viejo tapaba esta causa; si vuelve, el diagnóstico se pierde.
        expect(screen.queryByText(/No pudimos preparar el formulario de tarjeta/i)).not.toBeInTheDocument()
        // Nunca debió llamarse: sin llave no hay nada que cargar.
        expect(loadStripeMock).not.toHaveBeenCalled()
    })

    it("no ofrece reintento cuando el payload viene incompleto — reintentar no lo arregla", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload({ publishableKey: "" }))

        renderForm()

        await screen.findByText(/SETUP-PAYLOAD/)
        expect(screen.queryByRole("button", { name: /Intentar de nuevo/i })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Intentar con otra tarjeta/i })).not.toBeInTheDocument()
    })

    it("deja de mostrar «Preparando formulario…» cuando el montaje ya falló", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload({ clientSecret: null }))

        renderForm()

        await screen.findByText(/SETUP-PAYLOAD/)
        // En el video se veían los dos a la vez: el huésped esperaba un formulario
        // que ya nunca iba a llegar.
        expect(screen.queryByText(/Preparando formulario/i)).not.toBeInTheDocument()
    })

    it("separa «Stripe.js rechazó la llave» de «Stripe.js no cargó»", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload())
        loadStripeMock.mockRejectedValue(new Error("Expected publishable key to be of type string"))

        renderForm()

        expect(await screen.findByText(/El sistema de pagos rechazó la configuración/i)).toBeInTheDocument()
        expect(screen.getByText(/SETUP-KEY/)).toBeInTheDocument()
    })

    it("mantiene el aviso del bloqueador cuando loadStripe resuelve null", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload())
        loadStripeMock.mockResolvedValue(null)

        renderForm()

        expect(await screen.findByText(/bloqueador de anuncios/i)).toBeInTheDocument()
        expect(screen.getByText(/SETUP-BLOCKED/)).toBeInTheDocument()
        // Este sí lo puede resolver el huésped.
        expect(screen.getByRole("button", { name: /Intentar de nuevo/i })).toBeInTheDocument()
    })
})

describe("GuaranteeCardForm — montaje del campo de tarjeta", () => {
    it("monta el campo con un payload completo, sin dejar error a la vista", async () => {
        const { stripe, card } = stripeDouble()
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload())
        loadStripeMock.mockResolvedValue(stripe as never)

        renderForm()

        await waitFor(() => expect(card.mount).toHaveBeenCalledTimes(1))
        // El contenedor real del DOM, no un nodo suelto: es lo que fallaba cuando
        // el montaje corría antes de que React lo pintara.
        expect(card.mount).toHaveBeenCalledWith(screen.getByTestId("stripe-card-container"))
        await waitFor(() =>
            expect(screen.queryByText(/Preparando formulario/i)).not.toBeInTheDocument(),
        )
    })

    it("monta una sola vez tras pasar la puerta de información, sin carrera con el render", async () => {
        const { stripe, card } = stripeDouble()
        getGuaranteeStatus.mockResolvedValue(statusOf("not_started"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload())
        loadStripeMock.mockResolvedValue(stripe as never)
        const user = userEvent.setup()

        renderForm()

        // Con "not_started" primero va la puerta de información: nada de Stripe todavía.
        const continuar = await screen.findByRole("button", { name: /Continuar con confianza/i })
        expect(createGuaranteeSetupIntent).not.toHaveBeenCalled()

        await user.click(continuar)

        await waitFor(() => expect(card.mount).toHaveBeenCalledTimes(1))
        expect(createGuaranteeSetupIntent).toHaveBeenCalledTimes(1)
    })

    it("no vuelve a montar ni pide otro SetupIntent en re-renders", async () => {
        const { stripe, card } = stripeDouble()
        getGuaranteeStatus.mockResolvedValue(statusOf("detached"))
        createGuaranteeSetupIntent.mockResolvedValue(setupIntentPayload())
        loadStripeMock.mockResolvedValue(stripe as never)

        const { rerender } = renderForm()
        await waitFor(() => expect(card.mount).toHaveBeenCalledTimes(1))

        rerender(
            <GuaranteeCardForm
                reservationUuid="res-1"
                guestUuid="guest-1"
                onStatusChange={() => {}}
                onSessionExpired={() => {}}
            />,
        )

        // El endpoint NO es idempotente: cada llamada de más crea una fila de
        // método de pago `pending` en el backend.
        expect(createGuaranteeSetupIntent).toHaveBeenCalledTimes(1)
        expect(card.mount).toHaveBeenCalledTimes(1)
    })
})

describe("GuaranteeCardForm — reintento durante un montaje en vuelo", () => {
    /**
     * La carrera del iPhone (2026-09-03): `mountCardForm` tiene dos awaits antes
     * de `card.mount()`. Un reintento lanzado mientras el montaje anterior sigue
     * en vuelo terminaba con DOS iframes de Stripe apilados en el mismo
     * contenedor — lo tipeado y los placeholders superpuestos. Solo el montaje
     * vigente puede llegar a montar.
     */
    it("un reintento a mitad de vuelo no deja dos campos montados", async () => {
        const { stripe, card } = stripeDouble()
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        loadStripeMock.mockResolvedValue(stripe as never)

        // Setup-intents controlados a mano: el primero queda EN VUELO hasta que
        // el reintento ya arrancó el segundo montaje.
        const pending: Array<(v: ReturnType<typeof setupIntentPayload>) => void> = []
        createGuaranteeSetupIntent.mockImplementation(
            () => new Promise((resolve) => { pending.push(resolve) }),
        )
        const user = userEvent.setup()

        renderForm()

        // Primer montaje arrancó y espera su setup-intent.
        await waitFor(() => expect(createGuaranteeSetupIntent).toHaveBeenCalledTimes(1))

        // Reintento mientras el primero sigue en vuelo → segundo montaje.
        await user.click(await screen.findByRole("button", { name: /Intentar con otra tarjeta/i }))
        await waitFor(() => expect(createGuaranteeSetupIntent).toHaveBeenCalledTimes(2))

        // Ahora responden los DOS setup-intents, el zombi incluido.
        pending.forEach((resolve) => resolve(setupIntentPayload()))

        await waitFor(() => expect(card.mount).toHaveBeenCalledTimes(1))
        // Y sigue siendo uno aunque el zombi termine de procesar su respuesta.
        await new Promise((r) => setTimeout(r, 0))
        expect(card.mount).toHaveBeenCalledTimes(1)
    })
})

describe("GuaranteeCardForm — el contenedor sobrevive al estado pending", () => {
    it("mantiene el nodo del campo en el DOM mientras se confirma la tarjeta", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("pending"))

        renderForm()

        expect(await screen.findByText(/Confirmando tu tarjeta/i)).toBeInTheDocument()
        // Si React desmonta este nodo, se lleva el iframe de Stripe con él y el
        // huésped vuelve a un recuadro vacío si el sondeo termina en fallo.
        const container = screen.getByTestId("stripe-card-container")
        expect(container).toBeInTheDocument()
        expect(container).not.toBeVisible()
    })
})

describe("GuaranteeCardForm — sesión vencida", () => {
    it("delega el 401 del setup-intent en onSessionExpired, sin pintar un error", async () => {
        getGuaranteeStatus.mockResolvedValue(statusOf("failed"))
        const unauthorized = Object.assign(new Error("Unauthenticated"), { status: 401 })
        createGuaranteeSetupIntent.mockRejectedValue(unauthorized)
        const onSessionExpired = vi.fn()

        render(
            <GuaranteeCardForm
                reservationUuid="res-1"
                guestUuid="guest-1"
                onStatusChange={() => {}}
                onSessionExpired={onSessionExpired}
            />,
        )

        await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
        expect(screen.queryByText(/ref: SETUP-/)).not.toBeInTheDocument()
    })
})
