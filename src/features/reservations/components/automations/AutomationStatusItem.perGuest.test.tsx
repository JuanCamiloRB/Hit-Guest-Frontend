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

describe("AutomationStatusItem — error de la última ejecución", () => {
    it("se muestra con el aviso compartido: error compacto y fijo (no interrumpe al lector)", () => {
        renderItem({ item: { ...SIRE, isPerGuest: false, guests: [], lastError: "El servicio de SIRE no respondió" } })
        const notice = screen.getByText(/El servicio de SIRE no respondió/).closest("[data-slot=feedback-banner]")
        expect(notice).toHaveAttribute("data-tone", "danger")
        expect(notice).toHaveAttribute("data-mode", "static")
        expect(notice).toHaveAttribute("data-density", "compact")
        expect(notice).not.toHaveAttribute("role")
    })
})

describe("AutomationStatusItem — en pausa por credenciales rechazadas (nota backend 2026-11-11)", () => {
    const TRA: Item = {
        ...SIRE, automationUuid: "tra", automationName: "TRA", providerSlug: "tra_colombia",
        status: "pending", lastError: "credentials_rejected", isPerGuest: false, guests: [],
    }

    it("aunque llegue como pending: pastilla «En pausa», aviso con el enlace a la propiedad y sin despachar", () => {
        renderItem({ item: TRA, credentialsPaused: true, propertyUuid: "prop-1" })
        expect(screen.getByText("En pausa")).toBeInTheDocument()
        expect(screen.queryByText("Procesando")).toBeNull()
        expect(screen.getByText(/proveedor rechazó las credenciales/)).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Actualizar credenciales/ })).toHaveAttribute("href", "/dashboard/properties/prop-1?tab=automations")
        expect(screen.queryByRole("button", { name: /Reintentar|Disparar|Despachar/ })).toBeNull()
    })

    it("también con status failed: el aviso de pausa reemplaza al error genérico", () => {
        renderItem({ item: { ...TRA, status: "failed" }, credentialsPaused: true, propertyUuid: "prop-1" })
        expect(screen.getAllByText(/proveedor rechazó las credenciales/)).toHaveLength(1)
        expect(screen.queryByRole("button", { name: /Reintentar/ })).toBeNull()
    })

    it("por huésped: sin botones en las filas y el que ya terminó conserva su estado", () => {
        const item: Item = {
            ...SIRE,
            guests: [
                guest("g-ana", "Ana Pérez", { status: "pending", lastError: "credentials_rejected", canRedispatch: true, usageRecordId: 11 }),
                guest("g-luis", "Luis Gómez", { status: "completed" }),
            ],
        }
        renderItem({ item, credentialsPaused: true, propertyUuid: "prop-1" })
        const rows = within(screen.getByRole("list", { name: /Huéspedes de/ })).getAllByRole("listitem")
        expect(rows[0]).toHaveTextContent("En pausa")
        expect(rows[1]).toHaveTextContent("Completado")
        expect(screen.queryByRole("button", { name: /para Ana Pérez|Despachar pendientes/ })).toBeNull()
        expect(screen.getByRole("link", { name: /Actualizar credenciales/ })).toBeInTheDocument()
    })

    it("sin la propiedad, el aviso va sin enlace (nunca a una URL rota)", () => {
        renderItem({ item: TRA, credentialsPaused: true })
        expect(screen.getByText(/proveedor rechazó las credenciales/)).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: /Actualizar credenciales/ })).toBeNull()
    })

    it("en pausa no se muestra el candado del check-in: el arreglo es guardar las credenciales", () => {
        renderItem({
            item: { ...TRA, status: "not_started", lastError: null, canDispatch: false, requiresCheckin: "reservation", reservationCheckinCompleted: false },
            credentialsPaused: true,
            propertyUuid: "prop-1",
        })
        expect(screen.queryByText(/Todos los huéspedes deben completar el check-in/)).toBeNull()
    })

    it("un huésped completado conserva su estado aunque arrastre el código", () => {
        const item: Item = { ...SIRE, guests: [guest("g-ana", "Ana Pérez", { status: "completed", lastError: "credentials_rejected" })] }
        renderItem({ item, credentialsPaused: true, propertyUuid: "prop-1" })
        const rows = within(screen.getByRole("list", { name: /Huéspedes de/ })).getAllByRole("listitem")
        expect(rows[0]).toHaveTextContent("Completado")
    })
})
