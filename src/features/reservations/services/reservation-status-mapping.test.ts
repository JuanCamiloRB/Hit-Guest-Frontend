import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    listProperties: vi.fn(),
    listByProperty: vi.fn(),
    getReservationStatus: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({
    apiClient: { get: mocks.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    handleSessionExpired: vi.fn(),
}))
vi.mock("@/lib/store/auth-store", () => ({
    useAuthStore: { getState: () => ({ user: { token: "pm-token" } }) },
}))
vi.mock("@/features/properties/services/properties-service", () => ({
    propertiesService: { list: mocks.listProperties },
}))
vi.mock("@/features/properties/services/listings-service", () => ({
    listingsService: { listByProperty: mocks.listByProperty },
}))
vi.mock("@/features/properties/services/automation-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/properties/services/automation-service")>()),
    automationService: { getReservationStatus: mocks.getReservationStatus },
}))

import { ApiError } from "@/types/api"
import { ReservationsNotReadyError, mapReservationStatus, reservationsService } from "./reservations-service"

const TRANSLATED = { en: "Cancelled", es: "Cancelada" }

describe("mapReservationStatus — el id del catálogo manda, el nombre es respaldo", () => {
    it("resuelve por id aunque el nombre venga en cualquier forma", () => {
        expect(mapReservationStatus({ statusReservation: { id: 27, name: TRANSLATED } })).toBe("CONFIRMED")
        expect(mapReservationStatus({ statusReservationId: 29, statusReservation: { name: "Confirmada" } })).toBe("CANCELLED")
    })

    it("sin id, lee el nombre como objeto de traducciones o como JSON serializado — nunca revienta", () => {
        expect(mapReservationStatus({ statusReservation: { name: TRANSLATED } })).toBe("CANCELLED")
        expect(mapReservationStatus({ statusReservation: { name: JSON.stringify(TRANSLATED) } })).toBe("CANCELLED")
        expect(mapReservationStatus({ statusReservation: { name: "En Progreso" } })).toBe("IN_PROGRESS")
        expect(mapReservationStatus({ statusReservation: { name: { es: "Cualquiera" } } })).toBe("UNKNOWN")
        expect(mapReservationStatus({})).toBe("UNKNOWN")
    })
})


/**
 * Una página de `GET /reservations` con la forma de Laravel. Se entrega el
 * cuerpo en memoria (sin serializar) para poder meter una fila cuya lectura
 * lanza dentro del mapeador — `JSON.stringify` la haría estallar antes.
 */
function page(data: unknown[], meta?: Record<string, unknown>, status = 200) {
    const body = meta ? { data, meta } : { data }
    return { ok: status < 300, status, json: () => Promise.resolve(body) } as unknown as Response
}

const NUEVA = {
    uuid: "res-nueva",
    externalId: "MANUAL-ABC123",
    arrivalDate: "2026-10-10",
    departureDate: "2026-10-12",
    // Shape que el propio servicio documenta para el catálogo de estados.
    statusReservation: { id: 27, name: { en: "Confirmed", es: "Confirmada" } },
    extra: { guestName: "Ana", guestLastname: "Gómez" },
}

describe("reservationsService.list — lo que llega del backend no tumba ni recorta el listado", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "info").mockImplementation(() => {})
        mocks.listProperties.mockResolvedValue([])
        mocks.listByProperty.mockResolvedValue([])
        mocks.getReservationStatus.mockResolvedValue([])
    })

    it("la reserva recién creada aparece, con su estado resuelto por id aunque el nombre sea un objeto", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([NUEVA])))
        const list = await reservationsService.list()
        expect(list).toHaveLength(1)
        expect(list[0]).toMatchObject({ id: "res-nueva", status: "CONFIRMED", guestName: "Ana Gómez" })
    })

    it("sigue TODAS las páginas cuando el backend pagina (meta.last_page), no solo la primera", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(page([{ ...NUEVA, uuid: "r-1" }], { current_page: 1, last_page: 3, per_page: 1, total: 3 }))
            .mockResolvedValueOnce(page([{ ...NUEVA, uuid: "r-2" }], { current_page: 2, last_page: 3, per_page: 1, total: 3 }))
            .mockResolvedValueOnce(page([{ ...NUEVA, uuid: "r-3" }], { current_page: 3, last_page: 3, per_page: 1, total: 3 }))
        vi.stubGlobal("fetch", fetchMock)

        const list = await reservationsService.list()
        expect(list.map((r) => r.id)).toEqual(["r-1", "r-2", "r-3"])
        expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
            expect.stringMatching(/\/reservations\?page=1$/),
            expect.stringMatching(/\/reservations\?page=2$/),
            expect.stringMatching(/\/reservations\?page=3$/),
        ])
        // La sesión del PM viaja en CADA página: nunca el app token.
        for (const call of fetchMock.mock.calls) expect(call[1].headers.Authorization).toBe("Bearer pm-token")
    })

    it("un 202 se traduce a «todavía no», no a cero reservas", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([], undefined, 202)))
        await expect(reservationsService.list()).rejects.toBeInstanceOf(ReservationsNotReadyError)
    })

    it("un 200 sin arreglo falla en vez de borrar la tabla", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ message: "ok" }) }))
        await expect(reservationsService.list()).rejects.toThrow(/sin arreglo/)
    })

    it("una fila con forma inesperada se descarta sola; las demás se muestran", async () => {
        const rara = {
            ...NUEVA,
            uuid: "res-rara",
            emailGuest: { value: "no-es-texto" },
            source: { id: 22, name: { en: "Airbnb", es: "Airbnb" } },
            extra: null,
            mainGuest: null,
        }
        const rota = { uuid: "res-rota", arrivalDate: "2026-10-10", departureDate: "2026-10-12", extra: { get guestName() { throw new Error("boom") } } }
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([NUEVA, rara, rota])))

        const list = await reservationsService.list()
        expect(list.map((r) => r.id)).toEqual(["res-nueva", "res-rara"])
        expect(list[1]).toMatchObject({ source: "Airbnb", guestName: "Huésped" })
    })
})

describe("reservationsService.list — bordes de la paginación y de las filas", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "info").mockImplementation(() => {})
        mocks.listProperties.mockResolvedValue([])
        mocks.listByProperty.mockResolvedValue([])
        mocks.getReservationStatus.mockResolvedValue([])
    })

    it("una fila sin uuid ni id se descarta: no se consulta su estado ni se le arma un enlace", async () => {
        const sinId = { ...NUEVA, uuid: undefined, id: undefined }
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([NUEVA, sinId])))
        const list = await reservationsService.list()
        expect(list.map((r) => r.id)).toEqual(["res-nueva"])
        expect(mocks.getReservationStatus).toHaveBeenCalledTimes(1)
        expect(mocks.getReservationStatus).toHaveBeenCalledWith("res-nueva")
    })

    it("un meta.last_page que no es un entero ≥ 1 es un fallo, no cien peticiones", async () => {
        const fetchMock = vi.fn().mockResolvedValue(page([NUEVA], { last_page: "muchas" }))
        vi.stubGlobal("fetch", fetchMock)
        await expect(reservationsService.list()).rejects.toThrow(/last_page inválido/)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("más páginas que el máximo es un fallo explícito, nunca una lista parcial presentada como completa", async () => {
        const fetchMock = vi.fn().mockResolvedValue(page([NUEVA], { last_page: 500 }))
        vi.stubGlobal("fetch", fetchMock)
        await expect(reservationsService.list()).rejects.toThrow(/superan el máximo/)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
