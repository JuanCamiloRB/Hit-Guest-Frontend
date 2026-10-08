import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IdentifyScreen } from "./IdentifyScreen"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    identify: vi.fn(),
    getPortal: vi.fn(),
    getGuestFormSchema: vi.fn(),
    save: vi.fn(),
    saveRaw: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
    useSearchParams: () => ({ get: () => null }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError, info: vi.fn() } }))
vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        identify: mocks.identify,
        getPortal: mocks.getPortal,
        getGuestFormSchema: mocks.getGuestFormSchema,
    },
}))
vi.mock("@/features/checkin/hooks/useIdentifySession", () => ({
    useIdentifySession: () => ({ save: mocks.save, saveRaw: mocks.saveRaw }),
}))
vi.mock("@/features/auth/services/catalog-service", () => ({
    CatalogService: class {
        getCountries() {
            return Promise.resolve([{ id: 1, name: "Colombia", extra: { iso2: "CO" } }])
        }
        getIdentificationTypesV2() {
            return Promise.resolve([{ id: 3, name: "Cédula de ciudadanía" }])
        }
    },
}))

const PRICE_PLACEHOLDER = "Ej. 850.000"
const GUESTS_PLACEHOLDER = "Ej. 2"

function portalWith(reservation: Record<string, unknown>) {
    mocks.getPortal.mockResolvedValue({ reservation, registeredGuests: [], progress: {} })
}

async function fillIdentity() {
    fireEvent.change(await screen.findByPlaceholderText("Ej. Juan Carlos"), { target: { value: "Ana" } })
    fireEvent.change(screen.getByPlaceholderText("Ej. Rodríguez Barrera"), { target: { value: "Gómez" } })
    fireEvent.click(screen.getByText("Seleccionar país..."))
    fireEvent.click(await screen.findByText("Colombia"))
    fireEvent.click(screen.getByText("Selec."))
    fireEvent.click(await screen.findByText("Cédula de ciudadanía"))
    fireEvent.change(screen.getByPlaceholderText("Ej. 1234567890"), { target: { value: "80123456" } })
    fireEvent.click(screen.getByRole("checkbox"))
}

describe("IdentifyScreen — valor total declarado por el huésped (contrato 2026-09-27)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        mocks.identify.mockResolvedValue({
            guest: { uuid: "guest-1", name: "Ana", lastname: "Gómez" },
            reservationGuest: { isMainGuest: true, isCheckinCompleted: false },
            verification: { type: "document_upload" },
            formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
        })
    })

    it("QA 1: con los dos flags, el principal ve ocupación y valor con la moneda de la reserva", async () => {
        portalWith({ requiresGuestCountDeclaration: true, requiresPriceDeclaration: true, currency: "COP" })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialGuestCountRequired
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        expect(await screen.findByPlaceholderText(PRICE_PLACEHOLDER)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(GUESTS_PLACEHOLDER)).toBeInTheDocument()
        expect(screen.getByText(/Valor total de tu reserva \(COP\)/)).toBeInTheDocument()
    })

    it("los flags son independientes: solo valor, sin ocupación", async () => {
        portalWith({ requiresGuestCountDeclaration: false, requiresPriceDeclaration: true, currency: "USD" })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialPriceDeclaration={{ required: true, currency: "USD" }}
            />,
        )
        expect(await screen.findByPlaceholderText(PRICE_PLACEHOLDER)).toBeInTheDocument()
        expect(screen.queryByPlaceholderText(GUESTS_PLACEHOLDER)).toBeNull()
        expect(screen.getByText(/\(USD\)/)).toBeInTheDocument()
    })

    it("QA 8: una reserva manual o de Calry no muestra ninguno de los dos campos", async () => {
        portalWith({})
        render(<IdentifyScreen reservationUuid="res" basePath="/checkin/res" />)
        await screen.findByPlaceholderText("Ej. Juan Carlos")
        expect(screen.queryByPlaceholderText(PRICE_PLACEHOLDER)).toBeNull()
        expect(screen.queryByPlaceholderText(GUESTS_PLACEHOLDER)).toBeNull()
    })

    it("un acompañante nunca ve los campos aunque los flags lleguen en true, y puede enviar sin ellos", async () => {
        portalWith({ requiresGuestCountDeclaration: true, requiresPriceDeclaration: true, currency: "COP" })
        mocks.identify.mockResolvedValue({
            guest: { uuid: "guest-2", name: "Ana", lastname: "Gómez" },
            reservationGuest: { isMainGuest: false, isCheckinCompleted: false },
            verification: { type: "document_upload" },
            formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
        })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                isMainGuest={false}
                isSecondary
                initialGuestCountRequired
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await fillIdentity()
        expect(screen.queryByPlaceholderText(PRICE_PLACEHOLDER)).toBeNull()
        expect(screen.queryByPlaceholderText(GUESTS_PLACEHOLDER)).toBeNull()

        // Los flags que no ve tampoco lo bloquean ni viajan en su request.
        const submit = screen.getByRole("button", { name: "Continuar" })
        await waitFor(() => expect(submit).toBeEnabled())
        fireEvent.click(submit)
        await waitFor(() => expect(mocks.identify).toHaveBeenCalledOnce())
        const payload = mocks.identify.mock.calls[0][1]
        expect(payload.isMainGuest).toBe(false)
        expect(payload).not.toHaveProperty("totalGuests")
        expect(payload).not.toHaveProperty("totalPrice")
    })

    it("QA 7: si el PM registró el valor entre el render del servidor y el refetch, el campo se retira", async () => {
        portalWith({ requiresGuestCountDeclaration: true, requiresPriceDeclaration: false, currency: "COP" })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialGuestCountRequired
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await waitFor(() => expect(screen.queryByPlaceholderText(PRICE_PLACEHOLDER)).toBeNull())
        expect(screen.getByPlaceholderText(GUESTS_PLACEHOLDER)).toBeInTheDocument()
    })

    it("QA 3: «850.000,50» viaja como el número 850000.5 junto a la ocupación", async () => {
        portalWith({ requiresGuestCountDeclaration: true, requiresPriceDeclaration: true, currency: "COP" })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialGuestCountRequired
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await fillIdentity()
        fireEvent.change(screen.getByPlaceholderText(GUESTS_PLACEHOLDER), { target: { value: "3" } })
        fireEvent.change(screen.getByPlaceholderText(PRICE_PLACEHOLDER), { target: { value: "850.000,50" } })
        expect(screen.getByText(/Vas a declarar:/)).toBeInTheDocument()

        const submit = screen.getByRole("button", { name: "Continuar" })
        await waitFor(() => expect(submit).toBeEnabled())
        fireEvent.click(submit)

        await waitFor(() => expect(mocks.identify).toHaveBeenCalledOnce())
        expect(mocks.identify.mock.calls[0][1]).toMatchObject({
            isMainGuest: true,
            totalGuests: 3,
            totalPrice: 850000.5,
        })
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/checkin/res/verify?guest_uuid=guest-1"))
    })

    it("un valor inválido bloquea el envío y explica la forma esperada", async () => {
        portalWith({ requiresPriceDeclaration: true, currency: "COP" })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await fillIdentity()
        fireEvent.change(screen.getByPlaceholderText(PRICE_PLACEHOLDER), { target: { value: "85O000" } })
        expect(screen.getByText(/mayor que 0, con máximo dos decimales/)).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled())
        expect(mocks.identify).not.toHaveBeenCalled()
    })

    it("sin moneda en la reserva no se puede declarar el valor: se bloquea y se explica", async () => {
        portalWith({ requiresPriceDeclaration: true })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await fillIdentity()
        // El refetch vivo sin moneda es la autoridad: retira la del servidor.
        expect(await screen.findByRole("alert")).toHaveTextContent(/no informa en qué moneda/)
        expect(screen.queryByPlaceholderText(PRICE_PLACEHOLDER)).toBeNull()
        await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled())
        expect(mocks.identify).not.toHaveBeenCalled()
    })

    it("un código de moneda distinto al de la reserva no se envía como si fuera pesos", async () => {
        portalWith({ requiresPriceDeclaration: true, currency: "COP" })
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await fillIdentity()
        fireEvent.change(screen.getByPlaceholderText(PRICE_PLACEHOLDER), { target: { value: "USD 500" } })
        expect(screen.getByText("El valor debe declararse en COP, la moneda de tu reserva.")).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled())
    })

    it("QA 2: un solo 422 con los dos errores se muestra junto a cada campo", async () => {
        portalWith({ requiresGuestCountDeclaration: true, requiresPriceDeclaration: true, currency: "COP" })
        mocks.identify.mockRejectedValue(Object.assign(new Error("Datos inválidos"), {
            status: 422,
            errors: {
                totalGuests: ["Indícanos cuántos huéspedes vienen."],
                totalPrice: ["Indícanos el valor total de tu reserva para iniciar el check-in."],
            },
        }))
        render(
            <IdentifyScreen
                reservationUuid="res"
                basePath="/checkin/res"
                initialGuestCountRequired
                initialPriceDeclaration={{ required: true, currency: "COP" }}
            />,
        )
        await fillIdentity()
        fireEvent.change(screen.getByPlaceholderText(GUESTS_PLACEHOLDER), { target: { value: "3" } })
        fireEvent.change(screen.getByPlaceholderText(PRICE_PLACEHOLDER), { target: { value: "850000" } })
        const submit = screen.getByRole("button", { name: "Continuar" })
        await waitFor(() => expect(submit).toBeEnabled())
        fireEvent.click(submit)

        expect(await screen.findByText("Indícanos cuántos huéspedes vienen.")).toBeInTheDocument()
        expect(screen.getByText("Indícanos el valor total de tu reserva para iniciar el check-in.")).toBeInTheDocument()
        expect(mocks.push).not.toHaveBeenCalled()
    })
})

describe("IdentifyScreen — cupo agotado (portal §7)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        portalWith({})
    })

    it("se decide por errors.reservation, no por el texto: un mensaje sin «máximo» igual vuelve al hub", async () => {
        const message = "La reserva ya alcanzó el número de huéspedes permitidos."
        mocks.identify.mockRejectedValue(Object.assign(new Error(message), {
            status: 422,
            errors: { reservation: [message] },
        }))
        render(<IdentifyScreen reservationUuid="res" basePath="/checkin/res" />)
        await fillIdentity()
        const submit = screen.getByRole("button", { name: "Continuar" })
        await waitFor(() => expect(submit).toBeEnabled())
        fireEvent.click(submit)

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/checkin/res"))
        expect(mocks.toastError).toHaveBeenCalledWith(message)
        expect(mocks.toastError).not.toHaveBeenCalledWith("Por favor revisa los campos marcados")
    })
})
