import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientAccount, User } from "../types"

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }))

vi.mock("@/features/auth/services/auth-service", () => ({
    authService: { getClient: mocks.getClient, updateProfile: vi.fn() },
}))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getCountries: vi.fn().mockResolvedValue([]),
        getPersonTypes: vi.fn().mockResolvedValue([]),
        getIdentificationTypes: vi.fn().mockResolvedValue([]),
    },
}))
vi.mock("./ClientLogoSection", () => ({ ClientLogoSection: () => null }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ApiError } from "@/types/api"
import { ProfileForm } from "./ProfileForm"

const user = { id: "u1", firstName: "Camila", email: "camila@example.com", clientUuid: "c1" } as unknown as User
const account: ClientAccount = { uuid: "c1", logoUrl: null, profile: { personTypeId: "2", name: "Hoteles SAS", email: "camila@example.com" } }
const saveButton = () => screen.queryByRole("button", { name: /GUARDAR CAMBIOS/ })

describe("ProfileForm — nunca se guarda sobre una cuenta que no se pudo leer", () => {
    beforeEach(() => {
        mocks.getClient.mockReset()
    })

    it("si la cuenta no carga, lo dice con el motivo y no hay formulario ni «Guardar»", async () => {
        mocks.getClient.mockRejectedValueOnce(new Error("Servicio no disponible"))
        render(<ProfileForm user={user} />)

        expect(await screen.findByText("No pudimos cargar la cuenta")).toBeInTheDocument()
        expect(screen.getByText("Servicio no disponible")).toBeInTheDocument()
        expect(saveButton()).toBeNull()
    })

    it("Reintentar vuelve a pedir la cuenta y, si llega, muestra el formulario", async () => {
        mocks.getClient.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(account)
        render(<ProfileForm user={user} />)
        fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }))

        expect(await screen.findByRole("button", { name: /GUARDAR CAMBIOS/ })).toBeInTheDocument()
        expect(screen.getByDisplayValue("Hoteles SAS")).toBeInTheDocument()
        expect(mocks.getClient).toHaveBeenCalledTimes(2)
    })

    it("con cuenta en la sesión, una respuesta vacía también es un fallo: nada que guardar encima", async () => {
        mocks.getClient.mockResolvedValueOnce(null)
        render(<ProfileForm user={user} />)

        expect(await screen.findByText("No pudimos cargar la cuenta")).toBeInTheDocument()
        expect(screen.getByText(/La cuenta llegó vacía/)).toBeInTheDocument()
        expect(saveButton()).toBeNull()
    })

    it("sin cuenta en la sesión no se pide nada y el formulario sale con los datos de la sesión", async () => {
        render(<ProfileForm user={{ ...user, clientUuid: undefined } as User} />)

        expect(await screen.findByRole("button", { name: /GUARDAR CAMBIOS/ })).toBeInTheDocument()
        expect(mocks.getClient).not.toHaveBeenCalled()
    })

    it("un 401 se queda en el spinner (está redirigiendo): ni error ni formulario", async () => {
        mocks.getClient.mockRejectedValueOnce(new ApiError(401, { message: "Unauthenticated." }))
        render(<ProfileForm user={user} />)

        await waitFor(() => expect(mocks.getClient).toHaveBeenCalled())
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(screen.queryByText("No pudimos cargar la cuenta")).toBeNull()
        expect(saveButton()).toBeNull()
    })
})
