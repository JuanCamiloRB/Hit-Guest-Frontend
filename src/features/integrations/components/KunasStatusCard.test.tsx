import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { KunasStatusCard } from "./KunasStatusCard"
import { KunasIntegrationPanel } from "./KunasIntegrationPanel"
import { useKunasIntegration } from "../hooks/useKunasIntegration"
import type { Integration } from "../types"

const mocks = vi.hoisted(() => ({
    getKunas: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    updateConfiguration: vi.fn(),
    connect: vi.fn(),
}))

vi.mock("../services/integrations-service", () => ({
    integrationsService: {
        getKunas: mocks.getKunas,
        activate: mocks.activate,
        deactivate: mocks.deactivate,
        updateConfiguration: mocks.updateConfiguration,
        connect: mocks.connect,
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

describe("Integraciones — respuestas sin la integración completa (crash de producción 2026-11-18)", () => {
    beforeEach(() => vi.clearAllMocks())

    it("la tarjeta no revienta si `parameters` faltara: dice «—» en el correo", () => {
        const broken = { ...rejected, credentialsStatus: null, parameters: undefined } as unknown as Integration
        render(<KunasStatusCard integration={broken} justConnected={false} onSetActive={noop} onUpdateCredentials={noop} onDisconnect={noop} />)
        expect(screen.getByText("—")).toBeInTheDocument()
    })

    it("conectar con un 202 sin la integración: se vuelve a pedir; si todavía no existe, se dice que se está procesando", async () => {
        mocks.getKunas.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
        mocks.connect.mockResolvedValueOnce(null)
        const { result } = renderHook(() => useKunasIntegration())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await act(async () => { await result.current.connect({ token: "t", email: "a@b.co", password: "x" }) })
        await waitFor(() => expect(mocks.getKunas).toHaveBeenCalledTimes(2))
        expect(result.current.justConnected).toBe(true)
        expect(result.current.integration).toBeNull()
    })

    it("conectar con un 202 sin la integración y el GET ya la trae: se muestra la integración", async () => {
        mocks.getKunas.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...rejected, credentialsStatus: null })
        mocks.connect.mockResolvedValueOnce(null)
        const { result } = renderHook(() => useKunasIntegration())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await act(async () => { await result.current.connect({ token: "t", email: "a@b.co", password: "x" }) })
        await waitFor(() => expect(result.current.integration?.token).toBe("int-1"))
    })

    it("pausar con una respuesta sin la integración: se conserva lo que se veía y se relee", async () => {
        mocks.getKunas.mockResolvedValue({ ...rejected, credentialsStatus: null })
        mocks.deactivate.mockResolvedValueOnce(null)
        const { result } = renderHook(() => useKunasIntegration())
        await waitFor(() => expect(result.current.integration?.token).toBe("int-1"))
        await act(async () => { await result.current.setActive(false) })
        await waitFor(() => expect(mocks.getKunas).toHaveBeenCalledTimes(2))
        expect(result.current.integration?.token).toBe("int-1")
    })

    it("el panel, tras conectar sin que la integración exista todavía, avisa y no pide reconectar", async () => {
        mocks.getKunas.mockResolvedValue(null)
        mocks.connect.mockResolvedValueOnce(null)
        render(<KunasIntegrationPanel />)
        await screen.findByRole("button", { name: /Conectar/ })
        await act(async () => {
            fireEvent.change(screen.getByLabelText(/Token/), { target: { value: "tok" } })
            fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "pm@x.co" } })
            fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: "secreto" } })
        })
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Conectar/ })) })
        expect(await screen.findByText("Recibimos la conexión con KunasPMS")).toBeInTheDocument()
        expect(screen.getByText(/No hace falta volver a conectar/)).toBeInTheDocument()
    })
})
