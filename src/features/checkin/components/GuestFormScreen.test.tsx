import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    guestUuid: "g-main",
    isMain: true,
    getPortal: vi.fn(),
    getGuestFormSchema: vi.fn(),
}))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(`guest_uuid=${mocks.guestUuid}`),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@/features/checkin/hooks/useIdentifySession", () => ({
    useIdentifySession: () => ({
        load: () => ({ guestUuid: mocks.guestUuid, guestName: "", guestLastname: "", isMainGuest: mocks.isMain, verification: { type: "verified_ok" }, timestamp: Date.now() }),
    }),
}))
vi.mock("@/features/checkin/hooks/useVerificationRecovery", () => ({ useVerificationRecovery: () => vi.fn() }))
vi.mock("@/features/checkin/lib/verification-token", () => ({ getVerificationToken: () => null }))
vi.mock("@/features/auth/services/catalog-service", () => ({
    CatalogService: class {
        getCountries = async () => []
        getReasonsForTrip = async () => []
        getGenders = async () => []
        getIdentificationTypesV2 = async () => []
    },
}))
vi.mock("@/features/checkin/services/checkin-service", () => ({
    checkinService: {
        getPortal: mocks.getPortal,
        checkVerificationResult: vi.fn().mockRejectedValue(new Error("sin resultado")),
        getGuestFormSchema: mocks.getGuestFormSchema,
    },
}))

import { GuestFormScreen } from "./GuestFormScreen"

const LEGACY = "checkin-guest-form-res-1"
const DRAFT = { name: "Ada", lastname: "Lovelace", email: "ada@example.com" }

function portalFor(uuid: string, isMain: boolean, mainCompleted = false) {
    const guests = [{ uuid, isMain, isCompleted: false, verification: { status: "approved" } }]
    if (mainCompleted) guests.push({ uuid: "g-main", isMain: true, isCompleted: true, verification: { status: "approved" } })
    return { registeredGuests: guests, reservation: {} }
}

describe("GuestFormScreen — borrador por huésped", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        localStorage.setItem(LEGACY, JSON.stringify(DRAFT))
        mocks.getGuestFormSchema.mockResolvedValue(null)
    })

    it("un acompañante no abre el formulario con el borrador del titular, ni lo toca", async () => {
        mocks.guestUuid = "g-2"
        mocks.isMain = false
        mocks.getPortal.mockResolvedValue(portalFor("g-2", false))

        render(<GuestFormScreen reservationUuid="res-1" basePath="/checkin/res-1" />)
        await waitFor(() => expect(screen.queryByText("Preparando formulario...")).toBeNull())

        expect(screen.queryByDisplayValue("Ada")).toBeNull()
        expect(screen.queryByDisplayValue("ada@example.com")).toBeNull()
        expect(localStorage.getItem(LEGACY)).toBe(JSON.stringify(DRAFT))
    })

    it("el titular confirmado recupera su borrador viejo, queda en su clave y el viejo se borra", async () => {
        mocks.guestUuid = "g-main"
        mocks.isMain = true
        mocks.getPortal.mockResolvedValue(portalFor("g-main", true))

        render(<GuestFormScreen reservationUuid="res-1" basePath="/checkin/res-1" />)
        await waitFor(() => expect(screen.queryByText("Preparando formulario...")).toBeNull())

        expect(screen.getByDisplayValue("Ada")).toBeInTheDocument()
        expect(localStorage.getItem(LEGACY)).toBeNull()
        expect(JSON.parse(localStorage.getItem("checkin-guest-form-res-1-g-main") ?? "null")).toMatchObject(DRAFT)
    })

    it("el borrador viejo del titular gana sobre el prefill del backend (que solo llena lo vacío)", async () => {
        mocks.guestUuid = "g-main"
        mocks.isMain = true
        mocks.getPortal.mockResolvedValue(portalFor("g-main", true))
        mocks.getGuestFormSchema.mockResolvedValue({
            requiredFields: ["name", "lastname"], optionalFields: [], userFields: [],
            prefilledData: { name: "Backend", lastname: "Lovelace" },
        })

        render(<GuestFormScreen reservationUuid="res-1" basePath="/checkin/res-1" />)
        await waitFor(() => expect(screen.queryByText("Preparando formulario...")).toBeNull())

        expect(screen.getByDisplayValue("Ada")).toBeInTheDocument()
        expect(screen.queryByDisplayValue("Backend")).toBeNull()
    })

    it("con el titular ya terminado, el borrador viejo se borra al entrar un acompañante", async () => {
        mocks.guestUuid = "g-2"
        mocks.isMain = false
        mocks.getPortal.mockResolvedValue(portalFor("g-2", false, true))

        render(<GuestFormScreen reservationUuid="res-1" basePath="/checkin/res-1" />)
        await waitFor(() => expect(screen.queryByText("Preparando formulario...")).toBeNull())

        expect(localStorage.getItem(LEGACY)).toBeNull()
        expect(screen.queryByDisplayValue("Ada")).toBeNull()
    })
})
