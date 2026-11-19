import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/settings" }))
vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

import DashboardError from "./error"

describe("Límite de error del panel", () => {
    it("dice qué pasó, ofrece reintentar e ir al tablero, y muestra la referencia", () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        const beacon = vi.fn(() => true)
        Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
        const reset = vi.fn()
        const error = Object.assign(new Error("Cannot read properties of undefined (reading 'email')"), { digest: "abc123" })
        render(<DashboardError error={error} reset={reset} />)

        expect(screen.getByRole("alert")).toHaveTextContent("No pudimos mostrar esta sección")
        expect(screen.getByText("Referencia: abc123")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }))
        expect(reset).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("link", { name: "Ir al tablero" })).toHaveAttribute("href", "/dashboard")
        // El error sube a los logs del servidor con la ruta.
        expect(beacon).toHaveBeenCalledWith("/api/client-error", expect.any(Blob))
    })
})
