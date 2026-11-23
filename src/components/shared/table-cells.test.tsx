import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Users } from "lucide-react"

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

import { AbsentValue, ChannelCell, ColumnHeader, DataTileCell, IdentityCell } from "./table-cells"

describe("Celdas compartidas de las tablas", () => {
    it("ColumnHeader: el ícono sobre el nombre", () => {
        render(<ColumnHeader icon={Users} label="Huéspedes" />)
        const header = document.querySelector('[data-slot="column-header"]')!
        expect(header).toHaveTextContent("Huéspedes")
        expect(header.querySelector(".lucide-users")).not.toBeNull()
        expect(header).toHaveClass("flex-col")
    })

    it("ColumnHeader inline: el ícono a la izquierda del nombre, en una línea", () => {
        render(<ColumnHeader icon={Users} label="Capacidad" inline />)
        const header = document.querySelector('[data-slot="column-header"]')!
        expect(header).toHaveAttribute("data-layout", "inline")
        expect(header).not.toHaveClass("flex-col")
        expect(header.firstElementChild).toHaveClass("lucide-users")
        expect(header).toHaveTextContent("Capacidad")
    })

    it("AbsentValue: el guion en ink-4", () => {
        render(<AbsentValue />)
        expect(screen.getByText("—")).toHaveClass("text-ink-4")
    })

    it("IdentityCell: enlace real cuando la fila navega, texto cuando no; la línea secundaria aparte", () => {
        const { rerender } = render(<IdentityCell name="Habitación Doble" href="/x" secondary="HAB-DOB" />)
        expect(screen.getByRole("link", { name: "Habitación Doble" })).toHaveAttribute("href", "/x")
        expect(screen.getByText("HAB-DOB")).toHaveClass("text-xs", "text-ink-3")
        rerender(<IdentityCell name="Habitación Doble" />)
        expect(screen.queryByRole("link")).toBeNull()
        expect(screen.getByText("Habitación Doble")).toHaveClass("font-semibold", "text-ink")
        // Sin enlace no se pone morado al pasar por la fila: no se abre.
        expect(screen.getByText("Habitación Doble")).not.toHaveClass("group-hover/row:text-primary-hover")
    })

    it("IdentityCell que navega o abre: semibold y morado al pasar por la fila", () => {
        const { rerender } = render(<IdentityCell name="Habitación Doble" href="/x" />)
        expect(screen.getByRole("link", { name: "Habitación Doble" })).toHaveClass("font-semibold", "group-hover/row:text-primary-hover")
        rerender(<IdentityCell name="Habitación Doble" onOpen={() => {}} />)
        expect(screen.getByRole("button", { name: "Habitación Doble" })).toHaveClass("font-semibold", "group-hover/row:text-primary-hover")
    })

    it("ChannelCell chip: logo y nombre dentro de un Badge integration", () => {
        render(<ChannelCell channel="KunasPMS" name="KunasPMS" chip />)
        const badge = document.querySelector('[data-slot="badge"]')!
        expect(badge).toHaveAttribute("data-tone", "integration")
        expect(badge).toHaveClass("bg-secondary/10", "text-secondary-hover")
        expect(badge).toHaveTextContent("KunasPMS")
        expect(badge.querySelector("svg")).not.toBeNull()
    })

    it("ChannelCell: logo y nombre; con detalle se puede enfocar y lo abre", async () => {
        const { rerender } = render(<ChannelCell channel="Airbnb" name="Airbnb" />)
        expect(screen.queryByRole("button")).toBeNull()
        expect(document.querySelector('[data-slot="channel-cell"] svg')).not.toBeNull()
        rerender(<ChannelCell channel="KunasPMS" name="KunasPMS" detail={<p>ID en KunasPMS: 26118</p>} />)
        const trigger = screen.getByRole("button", { name: /KunasPMS/ })
        fireEvent.click(trigger)
        await act(async () => {})
        expect(await screen.findByText("ID en KunasPMS: 26118")).toBeInTheDocument()
    })

    it("DataTileCell: celda de dato con ícono y cifra, nombre accesible con la palabra, detalle al tocar; sin dato, guion deshabilitado", async () => {
        const { rerender } = render(<DataTileCell icon={Users} label="Huéspedes" value={6} valueText="6 huéspedes" />)
        const tile = screen.getByRole("button", { name: "Huéspedes: 6 huéspedes" })
        expect(tile).toHaveAttribute("data-tone", "data")
        expect(tile).toHaveTextContent("6")
        fireEvent.click(tile)
        await act(async () => {})
        expect(await screen.findByText("6 huéspedes")).toBeInTheDocument()

        rerender(<DataTileCell icon={Users} label="Huéspedes" value={null} />)
        const none = screen.getByRole("button", { name: "Huéspedes: sin declarar" })
        expect(none).toBeDisabled()
        expect(none).toHaveAttribute("data-tone", "none")
    })

    it("DataTileCell sin cifra pero con algo declarado: solo el ícono, y sigue abriendo su detalle", async () => {
        render(<DataTileCell icon={Users} label="Capacidad" value={null} declared valueText="huéspedes sin declarar, 2 baños" detail={<p>2 baños</p>} />)
        const tile = screen.getByRole("button", { name: "Capacidad: huéspedes sin declarar, 2 baños" })
        expect(tile).toBeEnabled()
        expect(tile).toHaveAttribute("data-tone", "data")
        expect(tile.querySelector('[data-slot="status-tile-count"]')).toBeNull()
        fireEvent.click(tile)
        await act(async () => {})
        expect(await screen.findByText("2 baños")).toBeInTheDocument()
    })
})
