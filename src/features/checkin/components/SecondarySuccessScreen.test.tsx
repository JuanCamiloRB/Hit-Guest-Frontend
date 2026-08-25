import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { CheckinPortalResponse } from "../types/checkin"
import { SecondarySuccessScreen } from "./SecondarySuccessScreen"

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(
        "guest_uuid=guest-1&entry=identity_already_completed",
    ),
}))

const portal: CheckinPortalResponse = {
    reservation: {
        uuid: "reservation",
        arrivalDate: "2026-08-14",
        departureDate: "2026-08-16",
        totalGuestsAllowed: 2,
    },
    progress: { registered: 1, completed: 1, isFullyCompleted: false },
    registeredGuests: [{
        uuid: "guest-1",
        name: "Ada",
        lastname: "Lovelace",
        isMain: false,
        isCompleted: true,
    }],
}

describe("SecondarySuccessScreen — reingreso completado", () => {
    it("no presenta un registro nuevo como exitoso", () => {
        render(<SecondarySuccessScreen portal={portal} reservationUuid="reservation" />)

        expect(screen.getByRole("heading", { name: "Este check-in ya estaba completado" })).toBeInTheDocument()
        expect(screen.getByText(/tipo y número de documento.*ya están registrados/i)).toBeInTheDocument()
        expect(screen.queryByText("¡Registro Exitoso!")).not.toBeInTheDocument()
    })
})
