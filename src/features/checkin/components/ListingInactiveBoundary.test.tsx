import { describe, it, expect, vi, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { ListingInactiveBoundary } from "./ListingInactiveBoundary"
import { signalIfListingInactive } from "../lib/listing-inactive-signal"
import { checkinService } from "../services/checkin-service"

function portalError(code: string) {
    return Object.assign(new Error("Esta reserva no puede procesarse porque el alojamiento asociado está inactivo o ya no existe."), { status: 422, code })
}

describe("ListingInactiveBoundary — un solo manejo para todo el portal (contrato 2026-10-27)", () => {
    afterEach(() => vi.unstubAllGlobals())

    it("ante el 422 de inactivo reemplaza la pantalla en curso por la de alojamiento inactivo", () => {
        render(<ListingInactiveBoundary><p>Formulario del huésped</p></ListingInactiveBoundary>)
        expect(screen.getByText("Formulario del huésped")).toBeInTheDocument()

        act(() => { signalIfListingInactive(portalError("PROPERTY_INACTIVE")) })

        expect(screen.queryByText("Formulario del huésped")).toBeNull()
        expect(screen.getByText("Check-in no disponible por ahora")).toBeInTheDocument()
        expect(screen.getByText(/el alojamiento asociado está inactivo/)).toBeInTheDocument()
    })

    it("cualquier otro error no la toca", () => {
        render(<ListingInactiveBoundary><p>Formulario del huésped</p></ListingInactiveBoundary>)
        act(() => { signalIfListingInactive(Object.assign(new Error("Campo inválido"), { status: 422, code: "INVALID_CODE" })) })
        expect(screen.getByText("Formulario del huésped")).toBeInTheDocument()
    })

    it("lo dispara el propio servicio del portal: una acción que recibe el 422 termina en esa pantalla", async () => {
        vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(
            JSON.stringify({ code: "LISTING_INACTIVE", message: "Esta reserva no puede procesarse porque el alojamiento asociado está inactivo o ya no existe." }),
            { status: 422, headers: { "Content-Type": "application/json" } },
        )))
        render(<ListingInactiveBoundary><p>Identificación</p></ListingInactiveBoundary>)

        await act(async () => {
            await checkinService.identify("res-1", { name: "Ana" } as Parameters<typeof checkinService.identify>[1]).catch(() => undefined)
        })

        expect(screen.queryByText("Identificación")).toBeNull()
        expect(screen.getByText("Check-in no disponible por ahora")).toBeInTheDocument()
    })
})
