import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExternalPmsIdsField, type ExternalPmsIdRowError } from "./ExternalPmsIdsField"
import { catalogService } from "@/features/auth/services/catalog-service"
import type { ExternalPmsId } from "../types"

/**
 * The real `source_pms` catalog, as returned by the live API (ago 2026). Ids are
 * copied from that response, not invented — a wrong id here would map a property
 * to the wrong PMS, the same failure mode the 14/15/16 fallback caused.
 */
const PMS_SOURCES = [
    { id: "100", name: "Airbnb" },
    { id: "101", name: "Booking.com" },
    { id: "134", name: "KunasPMS" },
]

function setup(
    value: ExternalPmsId[],
    { sources = PMS_SOURCES, rowErrors }: {
        sources?: typeof PMS_SOURCES
        rowErrors?: ExternalPmsIdRowError[]
    } = {},
) {
    vi.spyOn(catalogService, "getPmsSources").mockResolvedValue(sources)
    const onChange = vi.fn()
    render(
        <ExternalPmsIdsField
            subject="propiedad"
            value={value}
            onChange={onChange}
            rowErrors={rowErrors}
        />,
    )
    return { onChange, user: userEvent.setup() }
}

const firstExternalIdInput = async () =>
    (await screen.findAllByLabelText(/ID en el origen/i))[0]

describe("ExternalPmsIdsField", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it("offers to link an origin when the property has none", async () => {
        const { onChange, user } = setup([])

        const addButton = await screen.findByRole("button", { name: /vincular origen/i })
        expect(screen.getByText(/sin origen externo/i)).toBeInTheDocument()

        await user.click(addButton)
        expect(onChange).toHaveBeenCalledWith([{ sourcePmsId: 0, externalId: "" }])
    })

    it("edits the external id of an existing row without touching its origin", async () => {
        const { onChange, user } = setup([{ sourcePmsId: 134, externalId: "KP-90" }])

        await user.type(await firstExternalIdInput(), "0")

        expect(onChange).toHaveBeenLastCalledWith([{ sourcePmsId: 134, externalId: "KP-900" }])
    })

    it("caps the external id at the 60 characters the backend accepts", async () => {
        setup([{ sourcePmsId: 134, externalId: "" }])
        expect(await firstExternalIdInput()).toHaveAttribute("maxLength", "60")
    })

    it("removes a row", async () => {
        const { onChange, user } = setup([
            { sourcePmsId: 134, externalId: "KP-900" },
            { sourcePmsId: 100, externalId: "AIR-1" },
        ])

        await user.click(await screen.findByRole("button", { name: /quitar origen 1/i }))
        expect(onChange).toHaveBeenCalledWith([{ sourcePmsId: 100, externalId: "AIR-1" }])
    })

    it("runs out of origins instead of letting the PM build a duplicated source", async () => {
        setup([
            { sourcePmsId: 100, externalId: "AIR-1" },
            { sourcePmsId: 101, externalId: "BK-2" },
            { sourcePmsId: 134, externalId: "KP-3" },
        ])

        // Se espera el MENSAJE, no el botón deshabilitado: el botón ya nace
        // deshabilitado mientras carga el catálogo (`canAddRow` exige `!isLoading`),
        // así que esperar por eso se cumplía con el estado de carga inicial y la
        // aserción siguiente corría antes de que el catálogo llegara. Ese era el
        // test flaky: pasaba o fallaba según cuándo resolvía la promesa.
        expect(await screen.findByText(/ya vinculaste todos los orígenes disponibles/i))
            .toBeInTheDocument()
        expect(screen.getByRole("button", { name: /vincular otro origen/i })).toBeDisabled()
    })

    it("says the catalog is unavailable and blocks new links rather than guessing an id", async () => {
        setup([], { sources: [] })

        expect(await screen.findByText(/no se pudo cargar el catálogo de orígenes/i))
            .toBeInTheDocument()
        expect(screen.getByRole("button", { name: /vincular origen/i })).toBeDisabled()
    })

    /**
     * A saved origin with no matching catalog option used to make Radix fall back
     * to the "Seleccionar origen" placeholder — the PM's stored value read as
     * blank and looked lost, both mid-load and permanently on catalog failure.
     */
    it("keeps a saved origin visible when the catalog cannot label it", async () => {
        setup([{ sourcePmsId: 134, externalId: "KP-900" }], { sources: [] })

        expect(await screen.findByText("Origen #134")).toBeInTheDocument()
        expect(screen.queryByText("Seleccionar origen")).not.toBeInTheDocument()
        // The id itself never disappears from the form.
        expect(await firstExternalIdInput()).toHaveValue("KP-900")
    })

    it("never hides existing rows behind a loading spinner", async () => {
        setup([{ sourcePmsId: 134, externalId: "KP-900" }])

        // Present on the very first paint, before the catalog promise resolves.
        expect(await firstExternalIdInput()).toHaveValue("KP-900")
        await waitFor(() => expect(screen.getByText("KunasPMS")).toBeInTheDocument())
    })

    it("shows the caller's row error on the row that owns it", async () => {
        setup([{ sourcePmsId: 134, externalId: "" }], {
            rowErrors: [{ externalId: "Ingresa el ID externo" }],
        })

        expect(await screen.findByText("Ingresa el ID externo")).toBeInTheDocument()
        expect(await firstExternalIdInput()).toHaveAttribute("aria-invalid", "true")
    })
})
