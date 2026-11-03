import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { siAirbnb } from "simple-icons"
import { ReservationSourceIdentity, reservationSourceSlug } from "./ReservationSourceIdentity"

const paths = (el: HTMLElement) => Array.from(el.querySelectorAll("path")).map((p) => p.getAttribute("d"))

describe("ReservationSourceIdentity — misma regla de logo que la lista y el selector", () => {
    it("con marca conocida pinta su logo de Simple Icons", () => {
        const { container } = render(<ReservationSourceIdentity name="Airbnb" slug="airbnb" />)
        expect(paths(container)).toEqual([siAirbnb.path])
        expect(screen.getByText("Airbnb")).toBeInTheDocument()
    })

    it.each([["Vrbo", "vrbo"], ["Agoda", "agoda"], ["Despegar", "despegar"], ["KunasPMS", null]])(
        "%s (sin logo de marca) lleva el ícono neutro, no su inicial",
        (name, slug) => {
            const { container } = render(<ReservationSourceIdentity name={name} slug={slug} />)
            expect(container.querySelector(".lucide-globe2, .lucide-earth")).not.toBeNull()
            // El nombre se muestra una sola vez: no hay una inicial suelta al lado.
            expect(screen.queryByText(name.charAt(0))).toBeNull()
            expect(screen.getByText(name)).toBeInTheDocument()
        },
    )

    it("el respaldo por id sigue resolviendo el slug cuando el backend no lo manda", () => {
        expect(reservationSourceSlug({ id: 22, name: "Lo que sea" } as Parameters<typeof reservationSourceSlug>[0])).toBe("airbnb")
        expect(reservationSourceSlug({ id: 999, name: "Nuevo" } as Parameters<typeof reservationSourceSlug>[0])).toBeNull()
    })
})
