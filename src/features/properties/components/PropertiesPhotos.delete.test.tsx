import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

const mocks = vi.hoisted(() => ({ deleteImage: vi.fn(), uploadImages: vi.fn(), notifyError: vi.fn(), toastSuccess: vi.fn() }))

vi.mock("../services/properties-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/properties-service")>()
    return { ...actual, propertiesService: { deleteImage: mocks.deleteImage, uploadImages: mocks.uploadImages } }
})
vi.mock("@/lib/notify-error", () => ({ notifyError: mocks.notifyError }))
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }))

import { PropertiesPhotos } from "./PropertiesPhotos"

const A = "https://cdn.example.com/a.jpg"
const B = "https://cdn.example.com/b.jpg"

function Wrapper({ children, pictures }: { children: ReactNode; pictures: string[] }) {
    const form = useForm({ defaultValues: { uuid: "p-1", picturesUrl: pictures, thumbnailUrl: pictures[0] ?? "" } })
    return <FormProvider {...form}>{children}</FormProvider>
}

function renderPhotos(pictures = [A, B]) {
    const user = userEvent.setup()
    render(<Wrapper pictures={pictures}><PropertiesPhotos /></Wrapper>)
    return user
}

describe("PropertiesPhotos — eliminar una foto pide confirmación", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("cada foto tiene un botón visible (no depende del hover) con nombre que la identifica", () => {
        renderPhotos()
        const cover = screen.getByRole("button", { name: "Eliminar foto 1 de 2 (portada)" })
        const second = screen.getByRole("button", { name: "Eliminar foto 2 de 2" })
        for (const button of [cover, second]) {
            expect(button.className).not.toMatch(/opacity-0|group-hover/)
        }
        expect(screen.getByRole("img", { name: "Foto 2 de 2 de la propiedad" })).toBeInTheDocument()
    })

    it("con teclado: abre la confirmación sin borrar; Cancelar no borra", async () => {
        const user = renderPhotos()
        screen.getByRole("button", { name: "Eliminar foto 2 de 2" }).focus()
        await user.keyboard("{Enter}")

        const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar esta foto?" })
        expect(dialog).toHaveTextContent("Se elimina la foto 2 de 2 de la galería de la propiedad.")
        expect(mocks.deleteImage).not.toHaveBeenCalled()
        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(mocks.deleteImage).not.toHaveBeenCalled()
    })

    it("la portada avisa qué pasa con la portada", async () => {
        const user = renderPhotos()
        await user.click(screen.getByRole("button", { name: "Eliminar foto 1 de 2 (portada)" }))
        expect(await screen.findByRole("alertdialog")).toHaveTextContent("Es la portada: al guardar la propiedad, la siguiente foto queda como portada.")
    })

    it("la única foto avisa que la propiedad se queda sin portada", async () => {
        const user = renderPhotos([A])
        await user.click(screen.getByRole("button", { name: "Eliminar foto 1 de 1 (portada)" }))
        expect(await screen.findByRole("alertdialog")).toHaveTextContent("Es la única foto: al guardar la propiedad, se queda sin portada.")
    })

    it("mientras se sube una foto no se puede abrir el borrado (la galería está cambiando)", async () => {
        mocks.uploadImages.mockReturnValue(new Promise(() => {}))
        const { container } = render(<Wrapper pictures={[A, B]}><PropertiesPhotos /></Wrapper>)
        const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
        fireEvent.change(input, { target: { files: [new File(["x"], "nueva.jpg", { type: "image/jpeg" })] } })
        await waitFor(() => expect(mocks.uploadImages).toHaveBeenCalled())
        expect(screen.getByRole("button", { name: "Eliminar foto 2 de 2" })).toBeDisabled()
    })

    it("al confirmar: «Eliminando…» sin doble envío ni cierre; al terminar la galería se actualiza", async () => {
        let finish!: (value: unknown) => void
        mocks.deleteImage.mockReturnValue(new Promise((resolve) => { finish = resolve }))
        const user = renderPhotos()
        await user.click(screen.getByRole("button", { name: "Eliminar foto 2 de 2" }))
        const dialog = await screen.findByRole("alertdialog")
        await user.click(within(dialog).getByRole("button", { name: "Eliminar foto" }))

        expect(within(dialog).getByRole("button", { name: "Eliminando…" })).toBeDisabled()
        expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled()
        // El botón deshabilitado pierde el foco: el lector de pantalla lo oye aquí.
        expect(within(dialog).getByRole("status")).toHaveTextContent("Eliminando…")
        await user.keyboard("{Escape}")
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
        expect(mocks.deleteImage).toHaveBeenCalledTimes(1)
        expect(mocks.deleteImage).toHaveBeenCalledWith("p-1", B)

        finish({ extra: { picturesUrl: [A] } })
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(screen.queryByRole("button", { name: /Eliminar foto 2/ })).toBeNull()
        expect(screen.getByRole("button", { name: "Eliminar foto 1 de 1 (portada)" })).toBeInTheDocument()
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Foto eliminada")
    })

    it("si falla: avisa y el diálogo sigue abierto para reintentar", async () => {
        mocks.deleteImage.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({ extra: { picturesUrl: [A] } })
        const user = renderPhotos()
        await user.click(screen.getByRole("button", { name: "Eliminar foto 2 de 2" }))
        const dialog = await screen.findByRole("alertdialog")
        await user.click(within(dialog).getByRole("button", { name: "Eliminar foto" }))
        await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledWith(expect.any(Error), "No pudimos eliminar la foto"))
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()

        await user.click(within(dialog).getByRole("button", { name: "Eliminar foto" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(mocks.deleteImage).toHaveBeenCalledTimes(2)
    })
})
