import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { UploadZone, matchesAccept } from "./upload-zone"

const png = () => new File(["x"], "a.png", { type: "image/png" })
const txt = () => new File(["x"], "b.txt", { type: "text/plain" })
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!

describe("matchesAccept", () => {
    it("acepta por MIME exacto, comodín de tipo o extensión; sin accept acepta todo", () => {
        expect(matchesAccept(png(), "image/png")).toBe(true)
        expect(matchesAccept(png(), "image/*")).toBe(true)
        expect(matchesAccept(png(), ".PNG, .jpg")).toBe(true)
        expect(matchesAccept(txt(), "image/png,.jpg")).toBe(false)
        expect(matchesAccept(txt(), undefined)).toBe(true)
        expect(matchesAccept(txt(), "")).toBe(true)
    })
})

describe("UploadZone", () => {
    it("es un botón real con el input oculto como hermano, enlazados por aria-controls", () => {
        render(<UploadZone accept="image/png" hint="PNG hasta 10 MB" onFiles={() => {}} />)
        const button = screen.getByRole("button", { name: /Arrastra archivos aquí o haz clic para elegirlos/ })
        const input = fileInput()
        expect(button).toHaveAttribute("type", "button")
        expect(button.contains(input)).toBe(false)
        expect(button).toHaveAttribute("aria-controls", input.id)
        expect(button).toHaveAccessibleDescription("PNG hasta 10 MB")
        expect(input).toHaveAttribute("accept", "image/png")
        expect(input).toHaveClass("sr-only")
        // Hueco punteado del sistema, nunca colores a mano.
        expect(button).toHaveClass("border-dashed", "border-2", "bg-sunk/50", "rounded-lg", "focus-visible:outline-solid")
    })

    it("el clic y Enter sobre el botón abren el selector", async () => {
        const user = userEvent.setup()
        render(<UploadZone onFiles={() => {}} />)
        const open = vi.spyOn(fileInput(), "click").mockImplementation(() => {})
        const button = screen.getByRole("button")
        await user.click(button)
        expect(open).toHaveBeenCalledTimes(1)
        button.focus()
        await user.keyboard("{Enter}")
        expect(open).toHaveBeenCalledTimes(2)
    })

    it("al elegir archivos reparte aceptados y rechazados según accept, y vacía el input", async () => {
        const user = userEvent.setup({ applyAccept: false })
        const onFiles = vi.fn()
        const onRejected = vi.fn()
        render(<UploadZone accept="image/png" multiple onFiles={onFiles} onRejected={onRejected} />)
        const a = png()
        const b = txt()
        await user.upload(fileInput(), [a, b])
        expect(onFiles).toHaveBeenCalledTimes(1)
        expect(onFiles).toHaveBeenCalledWith([a])
        expect(onRejected).toHaveBeenCalledWith([b])
        expect(fileInput().value).toBe("")
    })

    it("soltar archivos hace lo mismo; arrastrar encima marca data-dragging", () => {
        const onFiles = vi.fn()
        const onRejected = vi.fn()
        render(<UploadZone accept="image/png" multiple onFiles={onFiles} onRejected={onRejected} />)
        const button = screen.getByRole("button")
        fireEvent.dragOver(button)
        expect(button).toHaveAttribute("data-dragging", "true")
        expect(button).toHaveClass("data-dragging:border-primary", "data-dragging:bg-primary/5")
        fireEvent.dragLeave(button)
        expect(button).not.toHaveAttribute("data-dragging")

        const a = png()
        const b = txt()
        fireEvent.drop(button, { dataTransfer: { files: [a, b] } })
        expect(onFiles).toHaveBeenCalledWith([a])
        expect(onRejected).toHaveBeenCalledWith([b])
        expect(button).not.toHaveAttribute("data-dragging")
    })

    it("sin multiple, de lo soltado se toma el primero aceptado", () => {
        const onFiles = vi.fn()
        render(<UploadZone accept="image/png" onFiles={onFiles} />)
        const a = png()
        const c = new File(["y"], "c.png", { type: "image/png" })
        fireEvent.drop(screen.getByRole("button"), { dataTransfer: { files: [a, c] } })
        expect(onFiles).toHaveBeenCalledWith([a])
    })

    it("subiendo: aria-busy, botón deshabilitado y el texto indeterminado", () => {
        render(<UploadZone status="uploading" uploadingLabel="Subiendo 5 fotos…" hint="PNG" onFiles={() => {}} />)
        const button = screen.getByRole("button", { name: "Subiendo 5 fotos…" })
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute("aria-busy", "true")
        expect(button.closest('[data-slot="upload-zone"]')).toHaveAttribute("data-status", "uploading")
        expect(screen.queryByText("PNG")).toBeNull()
        expect(button.querySelector("svg")).toHaveClass("animate-spin")
    })

    it("error: aviso compacto en danger y «Reintentar» llama a onRetry (solo si se da)", async () => {
        const user = userEvent.setup()
        const onRetry = vi.fn()
        const { rerender } = render(
            <UploadZone status="error" errorMessage="No se pudieron subir las fotos" onRetry={onRetry} onFiles={() => {}} />,
        )
        const banner = screen.getByRole("status")
        expect(banner).toHaveAttribute("data-tone", "danger")
        expect(banner).toHaveAttribute("data-density", "compact")
        expect(banner).toHaveTextContent("No se pudieron subir las fotos")
        await user.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(onRetry).toHaveBeenCalledTimes(1)

        rerender(<UploadZone status="error" errorMessage="No se pudieron subir las fotos" onFiles={() => {}} />)
        expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
    })

    it("deshabilitada: no abre, no acepta soltar y se ve hundida", () => {
        const onFiles = vi.fn()
        render(<UploadZone disabled onFiles={onFiles} />)
        const button = screen.getByRole("button")
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute("data-disabled", "true")
        expect(button).toHaveClass("data-disabled:bg-sunk", "data-disabled:text-ink-3")
        expect(fileInput()).toBeDisabled()
        fireEvent.dragOver(button)
        expect(button).not.toHaveAttribute("data-dragging")
        fireEvent.drop(button, { dataTransfer: { files: [png()] } })
        expect(onFiles).not.toHaveBeenCalled()
    })
})
