import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { KunasStatusCard } from "./KunasStatusCard"
import { useKunasIntegration } from "../hooks/useKunasIntegration"
import type { Integration } from "../types"

const mocks = vi.hoisted(() => ({
    getKunas: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    updateConfiguration: vi.fn(),
}))

vi.mock("../services/integrations-service", () => ({
    integrationsService: {
        getKunas: mocks.getKunas,
        activate: mocks.activate,
        deactivate: mocks.deactivate,
        updateConfiguration: mocks.updateConfiguration,
        connect: vi.fn(),
        disconnect: vi.fn(),
    },
}))

const rejected: Integration = {
    token: "int-1",
    providerId: 5,
    name: "Kunas",
    parameters: { email: "pm@example.com", pmsProperties: [] },
    statusProviderId: 8,
    credentialsStatus: { status: "rejected", reason: "login_rejected", providerMessage: "HTTP 401", since: null },
} as Integration

const noop = async () => {}

describe("KunasStatusCard — credenciales rechazadas (nota backend 2026-11-11)", () => {
    it("muestra el aviso y el único botón de credenciales dice «Actualizar credenciales»", () => {
        render(<KunasStatusCard integration={rejected} justConnected={false} onSetActive={noop} onUpdateCredentials={noop} onDisconnect={noop} />)
        expect(screen.getByText("Credenciales rechazadas")).toBeInTheDocument()
        expect(screen.getByText(/usuario o la contraseña fueron rechazados/)).toBeInTheDocument()
        expect(screen.getByText("Mensaje del proveedor: HTTP 401")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Actualizar credenciales/ })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Editar credenciales/ })).toBeNull()
    })

    it("sin pausa, el botón de siempre y ningún aviso", () => {
        render(<KunasStatusCard integration={{ ...rejected, credentialsStatus: null }} justConnected={false} onSetActive={noop} onUpdateCredentials={noop} onDisconnect={noop} />)
        expect(screen.queryByText(/Credenciales rechazadas/)).toBeNull()
        expect(screen.getByRole("button", { name: /Editar credenciales/ })).toBeInTheDocument()
    })
})

describe("useKunasIntegration — qué respuesta levanta la pausa", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getKunas.mockResolvedValue(rejected)
    })

    it("pausar o activar no la levanta: si la respuesta no trae el campo, se conserva", async () => {
        const withoutField = { ...rejected }
        delete withoutField.credentialsStatus
        mocks.deactivate.mockResolvedValue({ ...withoutField, statusProviderId: 10 })
        const { result } = renderHook(() => useKunasIntegration())
        await waitFor(() => expect(result.current.integration).not.toBeNull())
        await act(async () => { await result.current.setActive(false) })
        expect(result.current.integration?.statusProviderId).toBe(10)
        expect(result.current.integration?.credentialsStatus).toEqual(rejected.credentialsStatus)
    })

    it("guardar credenciales sí la levanta, aunque la respuesta no traiga el campo", async () => {
        const withoutField = { ...rejected }
        delete withoutField.credentialsStatus
        mocks.updateConfiguration.mockResolvedValue(withoutField)
        const { result } = renderHook(() => useKunasIntegration())
        await waitFor(() => expect(result.current.integration).not.toBeNull())
        await act(async () => { await result.current.updateCredentials({ email: "pm@example.com", password: "x" }) })
        expect(result.current.integration?.credentialsStatus).toBeNull()
    })
})

describe("KunasStatusCard — el diálogo no se desmonta al levantar la pausa", () => {
    it("guardar quita el aviso pero el diálogo abierto sigue montado", async () => {
        const { fireEvent } = await import("@testing-library/react")
        const { rerender } = render(<KunasStatusCard integration={rejected} justConnected={false} onSetActive={noop} onUpdateCredentials={noop} onDisconnect={noop} />)
        fireEvent.click(screen.getByRole("button", { name: /Actualizar credenciales/ }))
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        // El guardado levantó la pausa: llega la integración sin rechazo.
        rerender(<KunasStatusCard integration={{ ...rejected, credentialsStatus: null }} justConnected={false} onSetActive={noop} onUpdateCredentials={noop} onDisconnect={noop} />)
        expect(screen.queryByText(/Credenciales rechazadas/)).toBeNull()
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })
})
