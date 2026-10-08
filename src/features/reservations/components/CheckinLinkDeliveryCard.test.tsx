import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CheckinLinkDeliveryCard } from "./CheckinLinkDeliveryCard"
import type { CheckinLinkDeliveryStatus } from "../lib/checkin-link-delivery-status"

vi.mock("./ReservationDialog", () => ({ ReservationDialog: () => null }))

const sentBoth: CheckinLinkDeliveryStatus = {
    email: { sentAt: "2026-09-27T10:05:00Z", to: "doris@correo.com", status: "delivered", reason: null, statusAt: null },
    whatsapp: null,
    ota: { sentAt: "2026-09-27T10:00:00Z", via: "kunas_pms" },
}

describe("CheckinLinkDeliveryCard (reserva) — OTA y respaldo (contrato 2026-09-27 §13.5, §13.7)", () => {
    it("OTA se muestra «Enviado» con la vía, sin estado de entrega; el email fuera de los canales es respaldo", () => {
        render(
            <CheckinLinkDeliveryCard
                reservationUuid="res"
                delivery={sentBoth}
                channels={["ota_inbox"]}
                channelsResolved
                origin={{ originKnown: true, importSource: "kunas_pms" }}
            />,
        )
        expect(screen.getByText("Mensaje en la OTA")).toBeInTheDocument()
        expect(screen.getByText("Vía Kunas PMS")).toBeInTheDocument()
        expect(screen.getByText("Enviado")).toBeInTheDocument()
        expect(screen.getByText("Email (respaldo)")).toBeInTheDocument()
    })

    it("sin configuración resuelta no se afirma que el email fue respaldo", () => {
        render(
            <CheckinLinkDeliveryCard
                reservationUuid="res"
                delivery={sentBoth}
                channels={["email"]}
                channelsResolved={false}
                origin={{ originKnown: true, importSource: "kunas_pms" }}
            />,
        )
        expect(screen.getByText("Email")).toBeInTheDocument()
        expect(screen.queryByText("Email (respaldo)")).toBeNull()
    })

    it("con OTA activo, una reserva manual o de iCal avisa que el link sale por email", () => {
        const { rerender } = render(
            <CheckinLinkDeliveryCard
                reservationUuid="res"
                delivery={{ email: null, whatsapp: null, ota: null }}
                channels={["email", "ota_inbox"]}
                channelsResolved
                origin={{ originKnown: true, importSource: "ical" }}
            />,
        )
        expect(screen.getByText(/no vino de un PMS: el mensaje en la OTA no aplica/)).toBeInTheDocument()

        // Origen desconocido (backend sin `isImported`): no se afirma nada.
        rerender(
            <CheckinLinkDeliveryCard
                reservationUuid="res"
                delivery={{ email: null, whatsapp: null, ota: null }}
                channels={["email", "ota_inbox"]}
                channelsResolved
                origin={{ originKnown: false, importSource: null }}
            />,
        )
        expect(screen.queryByText(/no vino de un PMS/)).toBeNull()
    })
})
