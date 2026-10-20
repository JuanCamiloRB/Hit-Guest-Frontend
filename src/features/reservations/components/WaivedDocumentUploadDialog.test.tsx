import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ApiError } from "@/types/api"

const mocks = vi.hoisted(() => ({ upload: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("../services/reservations-service", () => ({ reservationsService: { uploadWaivedGuestDocuments: mocks.upload } }))
vi.mock("sonner", () => ({ toast: mocks.toast }))

import { WaivedDocumentUploadDialog } from "./WaivedDocumentUploadDialog"

const GUEST = { uuid: "g-1", name: "Ana", lastname: "Pérez" }
const jpg = (name = "f.jpg") => new File(["x"], name, { type: "image/jpeg" })

function renderDialog() {
    const handlers = { onOpenChange: vi.fn(), onUploaded: vi.fn(), onStale: vi.fn() }
    render(<WaivedDocumentUploadDialog open reservationUuid="r-1" guest={GUEST} {...handlers} />)
    return handlers
}

const pick = (label: RegExp, f: File) => fireEvent.change(screen.getByLabelText(label, { selector: "input" }), { target: { files: [f] } })

describe("WaivedDocumentUploadDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.URL.createObjectURL = vi.fn(() => "blob:preview")
        globalThis.URL.revokeObjectURL = vi.fn()
    })

    it("sin frente no envía y lo marca", async () => {
        renderDialog()
        fireEvent.click(screen.getByRole("button", { name: "Subir fotos" }))
        expect(await screen.findByText("Sube la foto del frente del documento.")).toBeInTheDocument()
        expect(mocks.upload).not.toHaveBeenCalled()
    })

    it("rechaza antes de enviar lo que no es JPG o PNG", () => {
        renderDialog()
        pick(/^Frente/, new File(["x"], "f.pdf", { type: "application/pdf" }))
        expect(screen.getByText("Solo imágenes JPG o PNG.")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Subir fotos" }))
        expect(mocks.upload).not.toHaveBeenCalled()
    })

    it("muestra «Procesando», bloquea el doble envío y entrega la fila nueva", async () => {
        let resolve!: (v: unknown) => void
        mocks.upload.mockReturnValue(new Promise((r) => { resolve = r }))
        const handlers = renderDialog()
        pick(/^Frente/, jpg())
        fireEvent.click(screen.getByRole("button", { name: "Subir fotos" }))

        const busy = await screen.findByRole("button", { name: /Procesando las fotos/ })
        expect(busy).toBeDisabled()
        fireEvent.click(busy)
        expect(mocks.upload).toHaveBeenCalledTimes(1)

        const updated = { uuid: "g-1" }
        resolve({ guest: updated, message: "Se guardaron las fotos." })
        await waitFor(() => expect(handlers.onUploaded).toHaveBeenCalledWith(updated))
        expect(mocks.toast.success).toHaveBeenCalledWith("Se guardaron las fotos.", expect.objectContaining({
            description: expect.stringMatching(/reporte PDF/),
        }))
        expect(handlers.onOpenChange).toHaveBeenCalledWith(false)
    })

    it("DOCUMENT_NOT_DETECTED marca la cara que falló", async () => {
        mocks.upload.mockRejectedValue(new ApiError(422, { success: false, errorType: "DOCUMENT_NOT_DETECTED", failedFields: ["back"], message: "En esta foto no hay un documento." } as never))
        renderDialog()
        pick(/^Frente/, jpg())
        pick(/^Reverso/, jpg("b.jpg"))
        fireEvent.click(screen.getByRole("button", { name: "Subir fotos" }))
        expect(await screen.findByText("En esta foto no hay un documento.")).toHaveAttribute("id", "waiver-back-help")
    })

    it("si la exoneración ya no existe, avisa y pide refrescar la ficha", async () => {
        mocks.upload.mockRejectedValue(new ApiError(422, { message: "La verificación ya no está exonerada." }))
        const handlers = renderDialog()
        pick(/^Frente/, jpg())
        fireEvent.click(screen.getByRole("button", { name: "Subir fotos" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("La verificación ya no está exonerada.")
        expect(handlers.onStale).toHaveBeenCalled()
    })
})

describe("WaivedDocumentUploadDialog — auditoría 2026-10-20", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.URL.createObjectURL = vi.fn(() => "blob:preview")
        globalThis.URL.revokeObjectURL = vi.fn()
    })

    it("el reverso opcional se puede quitar sin perder el frente, y libera su vista previa", () => {
        renderDialog()
        pick(/^Frente/, jpg())
        pick(/^Reverso/, jpg("b.jpg"))
        expect(screen.getByAltText("Vista previa: Reverso")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: /Quitar/ }))

        expect(screen.queryByAltText("Vista previa: Reverso")).toBeNull()
        expect(screen.getByAltText("Vista previa: Frente")).toBeInTheDocument()
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    })

    it("la vista previa se crea al elegir, no al renderizar", () => {
        renderDialog()
        expect(URL.createObjectURL).not.toHaveBeenCalled()
        pick(/^Frente/, jpg())
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it("es un formulario: enviar con Enter sube las fotos", async () => {
        mocks.upload.mockResolvedValue({ guest: { uuid: "g-1" }, message: "ok" })
        renderDialog()
        pick(/^Frente/, jpg())
        fireEvent.submit(screen.getByRole("button", { name: "Subir fotos" }).closest("form")!)
        await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    })

    it("el error bajo un campo se anuncia (role=alert)", async () => {
        renderDialog()
        fireEvent.click(screen.getByRole("button", { name: "Subir fotos" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("Sube la foto del frente del documento.")
    })
})
