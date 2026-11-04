import { act, renderHook, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReservationDetailData } from "../services/reservations-service"

const mocks = vi.hoisted(() => ({ getById: vi.fn() }))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { getById: mocks.getById },
}))

import {
    MAX_CACHED_DETAILS,
    detailCacheFor,
    prefetchReservationDetail,
    resetReservationDetailCache,
} from "../lib/reservation-detail-cache"
import { useReservationDetail } from "./useReservationDetail"

const detail = (uuid: string) => ({ uuid, guestName: `Huésped ${uuid}` } as ReservationDetailData)

describe("useReservationDetail", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetReservationDetailCache()
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.getById.mockImplementation(async (uuid: string) => detail(uuid))
    })

    it("precargada, la ficha se ve al instante y se revalida detrás con UNA sola petición más", async () => {
        prefetchReservationDetail("r1")
        await waitFor(() => expect(detailCacheFor("r1").read()).not.toBeNull())
        expect(mocks.getById).toHaveBeenCalledTimes(1)

        const { result } = renderHook(() => useReservationDetail("r1"))
        expect(result.current.data?.guestName).toBe("Huésped r1")
        expect(result.current.status).toBe("refreshing")

        await waitFor(() => expect(result.current.status).toBe("ready"))
        expect(mocks.getById).toHaveBeenCalledTimes(2)
    })

    it("una precarga en vuelo se comparte con la ficha que abre enseguida", async () => {
        let release!: (value: ReservationDetailData) => void
        mocks.getById.mockReturnValueOnce(new Promise<ReservationDetailData>((res) => { release = res }))
        prefetchReservationDetail("r1")
        const { result } = renderHook(() => useReservationDetail("r1"))
        expect(result.current.status).toBe("loading")
        expect(mocks.getById).toHaveBeenCalledTimes(1)

        await act(async () => release(detail("r1")))
        await waitFor(() => expect(result.current.status).toBe("ready"))
        expect(result.current.data?.uuid).toBe("r1")
    })

    it("una precarga que falla no deja rastro: al abrir se pide y se dice", async () => {
        mocks.getById.mockRejectedValueOnce(new Error("503")).mockRejectedValueOnce(new Error("503"))
        prefetchReservationDetail("r1")
        await waitFor(() => expect(mocks.getById).toHaveBeenCalledTimes(1))

        const { result } = renderHook(() => useReservationDetail("r1"))
        await waitFor(() => expect(result.current.status).toBe("error"))
        expect(result.current.errorMessage).toBe("503")
    })

    it("reservationCreated (también al editar) recarga la ficha conservando lo que se ve", async () => {
        const { result } = renderHook(() => useReservationDetail("r1"))
        await waitFor(() => expect(result.current.status).toBe("ready"))

        mocks.getById.mockResolvedValueOnce({ ...detail("r1"), guestName: "Editado" } as ReservationDetailData)
        await act(async () => { window.dispatchEvent(new Event("reservationCreated")) })
        await waitFor(() => expect(result.current.data?.guestName).toBe("Editado"))
    })

    it("cambiar de reserva cambia de ficha sin mezclar", async () => {
        const { result, rerender } = renderHook(({ id }) => useReservationDetail(id), { initialProps: { id: "r1" } })
        await waitFor(() => expect(result.current.data?.uuid).toBe("r1"))
        rerender({ id: "r2" })
        expect(result.current.data).toBeNull()
        await waitFor(() => expect(result.current.data?.uuid).toBe("r2"))
    })

    it("una ficha ya en caché no se vuelve a precargar (al abrirla se revalida igual)", async () => {
        prefetchReservationDetail("r1")
        await waitFor(() => expect(detailCacheFor("r1").read()).not.toBeNull())
        prefetchReservationDetail("r1")
        expect(mocks.getById).toHaveBeenCalledTimes(1)
    })

    it("cambiar de reserva nunca pasa por «error» ni hereda el fallo de la anterior", async () => {
        mocks.getById.mockImplementationOnce(async () => { throw new Error("503") })
        // Solo lo que se confirma en pantalla (efecto), no los renders que React descarta.
        const committed: string[] = []
        const { result, rerender } = renderHook(({ id }) => {
            const state = useReservationDetail(id)
            useEffect(() => { committed.push(`${id}:${state.status}`) })
            return state
        }, { initialProps: { id: "r1" } })
        await waitFor(() => expect(result.current.status).toBe("error"))

        rerender({ id: "r2" })
        await waitFor(() => expect(result.current.data?.uuid).toBe("r2"))
        expect(result.current.errorMessage).toBeNull()
        expect(committed.filter((entry) => entry.startsWith("r2:"))).not.toContain("r2:error")
    })

    it("el mapa olvida la ficha más antigua al pasar el tope", () => {
        const r0 = detailCacheFor("r0")
        for (let i = 1; i <= MAX_CACHED_DETAILS; i++) detailCacheFor(`r${i}`)
        expect(detailCacheFor("r0")).not.toBe(r0)
    })
})
