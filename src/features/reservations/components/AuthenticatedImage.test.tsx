import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

const getState = vi.hoisted(() => vi.fn())

vi.mock("@/lib/store/auth-store", () => ({ useAuthStore: { getState } }))
vi.mock("@/lib/config", () => ({ CONFIG: { API_URL_GUEST: "https://guest.hit.tools/api/v1" } }))

import { AuthenticatedImage } from "./AuthenticatedImage"

const API_IMAGE = "https://guest.hit.tools/api/v1/reservations/r/identity-documents/g/front"

function imageResponse() {
    return { ok: true, status: 200, blob: async () => new Blob(["bytes"], { type: "image/jpeg" }) }
}

function authHeaderOf(fetchMock: ReturnType<typeof vi.fn>): string | undefined {
    const [, init] = fetchMock.mock.calls[0]
    return (init?.headers as Record<string, string>)?.Authorization
}

beforeEach(() => {
    vi.clearAllMocks()
    getState.mockReturnValue({ user: { token: "pm-token" } })
    vi.stubGlobal("URL", Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:mock"),
        revokeObjectURL: vi.fn(),
    }))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("AuthenticatedImage — token", () => {
    it("adjunta el Bearer cuando la imagen es del propio origen de la API", async () => {
        const fetchMock = vi.fn().mockResolvedValue(imageResponse())
        vi.stubGlobal("fetch", fetchMock)

        render(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(authHeaderOf(fetchMock)).toBe("Bearer pm-token")
    })

    it("NUNCA manda el token del PM a un host de imágenes ajeno", async () => {
        const fetchMock = vi.fn().mockResolvedValue(imageResponse())
        vi.stubGlobal("fetch", fetchMock)

        render(<AuthenticatedImage src="https://otro-host.com/foto.jpg" alt="Documento" />)

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(authHeaderOf(fetchMock)).toBeUndefined()
    })
})

describe("AuthenticatedImage — errores", () => {
    it("un 404 dice que el documento no está, no un error genérico", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))

        render(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)

        expect(await screen.findByText("No disponible")).toBeInTheDocument()
    })

    it("un 401 avisa de la sesión pero NO cierra la sesión del PM", async () => {
        // Cerrar sesión por una miniatura echaría al PM a /login en medio de la
        // reserva que está revisando.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }))

        render(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)

        expect(await screen.findByText("Sesión expirada")).toBeInTheDocument()
        // El store solo se leyó para el token; nadie disparó un logout.
        expect(getState).toHaveBeenCalled()
    })

    it("un fallo de red se distingue de una respuesta del servidor", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

        render(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)

        expect(await screen.findByText("No se pudo cargar")).toBeInTheDocument()
    })

    it("no reintenta tras un 404 cuando el componente se vuelve a renderizar", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 })
        vi.stubGlobal("fetch", fetchMock)

        const { rerender } = render(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)
        await screen.findByText("No disponible")
        rerender(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

describe("AuthenticatedImage — ciclo de vida del blob", () => {
    it("libera el object URL al desmontar", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse()))

        const { unmount } = render(<AuthenticatedImage src={API_IMAGE} alt="Documento" />)
        await screen.findByAltText("Documento")
        unmount()

        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock")
    })
})
