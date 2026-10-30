import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AutomationStatusItem } from "./AutomationStatusItem"
import { automationActionKey } from "@/features/reservations/hooks/useAutomationStatus"
import type { AutomationGuestStatus, AutomationStatusItem as Item } from "@/features/properties/types/automation"

function guest(uuid: string, name: string, over: Partial<AutomationGuestStatus> = {}): AutomationGuestStatus {
    return {
        guestUuid: uuid, name, isMainGuest: false, checkinCompleted: true, status: "not_started",
        usageRecordId: null, lastError: null, lastRunAt: null, canDispatch: false, canRedispatch: false, ...over,
    }
}

const SIRE: Item = {
    automationUuid: "sire", automationName: "SIRE Colombia", providerSlug: "sire_colombia", status: "failed",
    lastError: null, lastRunAt: null, usageRecordId: 99, contractPdfPath: null, wasSuccessful: false,
    lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: true,
    reservationCheckinCompleted: true, mainGuestCheckinCompleted: true, canDispatch: true, canRedispatch: true,
    isPerGuest: true,
    guests: [
        guest("g-ana", "Ana Pérez", { isMainGuest: true, status: "failed", usageRecordId: 11, canRedispatch: true, lastError: "timeout" }),
        guest("g-luis", "Luis Gómez", { canDispatch: true }),
        guest("g-co", "Carla Ortiz", { status: "skipped" }),
    ],
}

function renderItem(over: Partial<Parameters<typeof AutomationStatusItem>[0]> = {}) {
    const handlers = { onRedispatch: vi.fn(), onDispatch: vi.fn(), onResendPdf: vi.fn(), onViewHistory: vi.fn() }
    render(
        <AutomationStatusItem
            item={SIRE}
            reservationUuid="res-1"
            now={Date.now()}
            redispatchingKeys={new Set()}
            dispatchingKeys={new Set()}
            cooldownUntil={{}}
            {...handlers}
            {...over}
        />,
    )
    return handlers
}

describe("AutomationStatusItem — automatización por huésped (contrato 2026-10-27 §2.4–2.5)", () => {
    it("una subfila por huésped, con su estado; `skipped` es «No aplica», no error ni pendiente", () => {
        renderItem()
        const list = screen.getByRole("list", { name: /Huéspedes de/ })
        const rows = within(list).getAllByRole("listitem")
        expect(rows).toHaveLength(3)
        expect(rows[0]).toHaveTextContent("Ana Pérez")
        expect(rows[0]).toHaveTextContent("Titular")
        expect(rows[0]).toHaveTextContent("Fallido")
        expect(rows[2]).toHaveTextContent("No aplica")
    })

    it("cada huésped tiene SU acción, según los permisos del backend", async () => {
        const handlers = renderItem()
        const user = userEvent.setup()
        await user.click(screen.getByRole("button", { name: "Reintentar para Ana Pérez" }))
        expect(handlers.onRedispatch).toHaveBeenCalledWith(SIRE, SIRE.guests[0])
        await user.click(screen.getByRole("button", { name: "Despachar para Luis Gómez" }))
        expect(handlers.onDispatch).toHaveBeenCalledWith(SIRE, SIRE.guests[1])
        expect(screen.queryByRole("button", { name: /para Carla Ortiz/ })).toBeNull()
    })

    it("arriba solo queda «Despachar pendientes» (sin huésped); el reintento es por huésped", async () => {
        const handlers = renderItem()
        await userEvent.setup().click(screen.getByRole("button", { name: /Despachar pendientes/ }))
        expect(handlers.onDispatch).toHaveBeenCalledWith(SIRE)
        expect(screen.queryByRole("button", { name: /^Reintentar$/ })).toBeNull()
    })

    it("el enfriamiento de un huésped no bloquea al otro", () => {
        renderItem({ cooldownUntil: { [automationActionKey("sire", "g-ana")]: Date.now() + 120_000 } })
        expect(screen.getByRole("button", { name: "Reintentar para Ana Pérez" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Despachar para Luis Gómez" })).toBeEnabled()
    })
})
