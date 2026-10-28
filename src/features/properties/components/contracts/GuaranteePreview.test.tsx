import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ language: "es", getBySlug: vi.fn() }))
vi.mock("@/store/useLanguageStore", () => ({
    useLanguageStore: (select: (s: { language: string }) => unknown) => select({ language: mocks.language }),
}))
vi.mock("../../services/system-document-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/system-document-service")>()
    return { ...actual, systemDocumentService: { getBySlug: mocks.getBySlug } }
})

import { GuaranteePreview } from "./GuaranteePreview"

const TEMPLATE = "<p>Mecanismo de garantía activo: {{guarantee_mechanism}}</p><p>Monto máximo: {{guarantee_amount}} USD</p><p>Huésped: {{guest_first_name}}</p>"

function doc(extraEs: Record<string, string | null>) {
    return {
        uuid: "d", slug: "damage_consumption_guarantee", createdAt: "", updatedAt: "",
        content: { es: TEMPLATE, en: "<p>Active mechanism: {{guarantee_mechanism}}</p>" },
        extra: {
            es: extraEs,
            en: { guarantee_mechanism: "Card on File", guarantee_amount: "1000", guarantee_release_hours: "48", damage_catalog_url: "https://x.test" },
        },
    }
}

describe("GuaranteePreview — valores de la DB, sin advertencia falsa (2026-10-29)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.language = "es"
    })

    it("con las variables configuradas muestra los valores y ninguna advertencia", async () => {
        mocks.getBySlug.mockResolvedValue(doc({ guarantee_mechanism: "Tarjeta en Garantía", guarantee_amount: "1000", guarantee_release_hours: "48", damage_catalog_url: "https://x.test" }))
        render(<GuaranteePreview />)

        expect(await screen.findByText("Mecanismo de garantía activo: Tarjeta en Garantía")).toBeInTheDocument()
        expect(screen.getByText("Monto máximo: 1000 USD")).toBeInTheDocument()
        // La variable de la reserva queda tal cual y no dispara ningún aviso.
        expect(screen.getByText("Huésped: {{guest_first_name}}")).toBeInTheDocument()
        expect(screen.queryByText(/No pudimos cargar toda la configuración/)).toBeNull()
        expect(screen.queryByText(/PDF firmado/)).toBeNull()
    })

    it("usa los valores del MISMO idioma que el texto", async () => {
        mocks.language = "en"
        mocks.getBySlug.mockResolvedValue(doc({ guarantee_mechanism: "Tarjeta en Garantía" }))
        render(<GuaranteePreview />)
        expect(await screen.findByText("Active mechanism: Card on File")).toBeInTheDocument()
    })

    it("si falta una variable de la garantía, avisa sin prometer cómo sale el PDF", async () => {
        mocks.getBySlug.mockResolvedValue(doc({ guarantee_mechanism: "Tarjeta en Garantía", guarantee_amount: null }))
        render(<GuaranteePreview />)

        expect(await screen.findByText("No pudimos cargar toda la configuración de garantía para esta previsualización.")).toBeInTheDocument()
        expect(screen.getByText("{{guarantee_amount}}").tagName).toBe("MARK")
    })

    it("si el endpoint falla, conserva el mensaje de carga fallida", async () => {
        mocks.getBySlug.mockRejectedValue(new Error("red"))
        render(<GuaranteePreview />)
        expect(await screen.findByText(/No se pudo cargar el texto de garantía/)).toBeInTheDocument()
    })
})
