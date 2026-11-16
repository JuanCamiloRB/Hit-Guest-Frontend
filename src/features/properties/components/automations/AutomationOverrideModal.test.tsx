import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AutomationOverrideModal } from "./AutomationOverrideModal"
import { ApiError } from "@/types/api"
import { resetIdentityProviderCatalogCache } from "../../hooks/useIdentityProviderCatalog"
import { AUTOMATION_STATUS, type ListingAutomationOverride, type PropertyAutomation, type Provider } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    createListingOverride: vi.fn(),
    updateListingOverride: vi.fn(),
    deleteListingOverride: vi.fn(),
    listListingOverrides: vi.fn(),
    listProviders: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return {
        ...actual,
        automationService: {
            createListingOverride: mocks.createListingOverride,
            updateListingOverride: mocks.updateListingOverride,
            deleteListingOverride: mocks.deleteListingOverride,
            listListingOverrides: mocks.listListingOverrides,
            listProviders: mocks.listProviders,
        },
    }
})
vi.mock("sonner", () => ({ toast: mocks.toast }))

function provider(id: number, slug: string, verification_type?: string): Provider {
    return {
        id, name: slug, description: null, order: 0, statusProviderId: 8,
        parameters: { slug, ...(verification_type ? { verification_type } : {}) },
    }
}

/** Ids arbitrarios a propósito: ninguno es 1000/1004, nada se resuelve por id fijo. */
const ADVANCED = provider(501, "didit", "session")
const ESSENTIAL = provider(502, "textract", "document_upload")

/** Reporte PDF: automatización con parámetros por unidad, NO de identidad. */
const PDF: PropertyAutomation = {
    uuid: "pdf-row",
    propertyUuid: "property-1",
    providerId: 1003,
    providerName: "pdf_report",
    provider: provider(1003, "pdf_report"),
    name: "Guest Report PDF",
    guestType: "all",
    executionOrder: 30,
    parameters: { recipients: ["ops@x.com"] },
    token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE,
    deletedAt: null,
    isActive: true,
}

/** Verificación principal de la propiedad: activa con Avanzada. */
const IDENTITY: PropertyAutomation = {
    uuid: "identity-main",
    propertyUuid: "property-1",
    providerId: 501,
    providerName: "didit",
    provider: ADVANCED,
    automationType: "identity_verification",
    name: "Identity Verification - Main Guest",
    guestType: "main_guest",
    executionOrder: 1,
    parameters: {},
    token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE,
    deletedAt: null,
    isActive: true,
}

function override(over: Partial<ListingAutomationOverride> = {}): ListingAutomationOverride {
    return {
        uuid: "ov-1",
        listingUuid: "unit-1",
        propertyAutomationUuid: "identity-main",
        parameters: null,
        token: null,
        statusRecordId: 6,
        deletedAt: null,
        isActive: true,
        ...over,
    }
}

function renderModal(props: Partial<Parameters<typeof AutomationOverrideModal>[0]> = {}) {
    const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onInheritRestored: vi.fn() }
    const automation = (props.propertyAutomations?.[0] ?? IDENTITY)
    render(
        <AutomationOverrideModal
            open
            listingUuid="unit-1"
            listingName="Tree House Tipo A"
            propertyAutomations={[automation]}
            lockedPropertyAutomationUuid={automation.uuid}
            override={null}
            {...handlers}
            {...props}
        />,
    )
    return handlers
}

beforeEach(() => {
    vi.clearAllMocks()
    resetIdentityProviderCatalogCache()
    mocks.listProviders.mockResolvedValue([provider(1, "tra_colombia"), ADVANCED, ESSENTIAL])
})

/**
 * Automatización con credenciales en `parameters`. Los valores son centinelas:
 * si alguno aparece en el HTML del modal (texto, placeholder, aria-*), el
 * modal está mostrando un valor de la propiedad que no debe ver nadie.
 */
function withCredentials(uuid: string, slug: string, parameters: Record<string, unknown>): PropertyAutomation {
    return { ...PDF, uuid, providerName: slug, provider: provider(900, slug), name: slug, parameters }
}

describe("AutomationOverrideModal — nunca muestra los valores de la propiedad", () => {
    const CASES: Array<[string, PropertyAutomation]> = [
        ["TRA", withCredentials("tra-row", "tra_colombia", { token: "SENTINEL-TRA-TOKEN", rnt: "SENTINEL-RNT" })],
        ["SIRE", withCredentials("sire-row", "sire_colombia", {
            document_type: "CC", document_number: "SENTINEL-DOC", password: "SENTINEL-SIRE-PASS", company_code: "SENTINEL-NIT",
        })],
        ["TTLock", withCredentials("ttlock-row", "ttlock", {
            username: "SENTINEL-USER", password: "SENTINEL-LOCK-PASS", client_id: "SENTINEL-CLIENT-ID", client_secret: "SENTINEL-CLIENT-SECRET",
        })],
    ]

    it.each(CASES)("%s: ni secretos ni datos de la propiedad en texto, placeholder ni aria", (_name, automation) => {
        renderModal({ propertyAutomations: [automation], lockedPropertyAutomationUuid: automation.uuid })
        const dialog = screen.getByRole("dialog")
        expect(dialog.outerHTML).not.toMatch(/SENTINEL/)
        // El campo sigue diciendo que, vacío, usa lo de la propiedad, sin decir qué es.
        expect(screen.getAllByPlaceholderText("Usa el valor de la propiedad").length).toBeGreaterThan(0)
    })

    it("un campo que la propiedad no tiene conserva su texto de ejemplo", () => {
        const automation = withCredentials("tra-row", "tra_colombia", { token: "SENTINEL-TRA-TOKEN" })
        renderModal({ propertyAutomations: [automation], lockedPropertyAutomationUuid: automation.uuid })
        expect(screen.getByPlaceholderText("Número RNT del establecimiento")).toBeInTheDocument()
        expect(screen.getByRole("dialog").outerHTML).not.toMatch(/SENTINEL/)
    })
})

describe("AutomationOverrideModal — automatizaciones que no son de identidad", () => {
    const pdf = { propertyAutomations: [PDF], lockedPropertyAutomationUuid: "pdf-row" }

    it("una unidad que hereda y se guarda sin cambios NO crea un override", async () => {
        const handlers = renderModal(pdf)
        expect(screen.getByText(/Hoy hereda de la propiedad/)).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(handlers.onClose).toHaveBeenCalled()
        expect(mocks.listProviders).not.toHaveBeenCalled()
    })

    it("apagarla en la unidad crea el override inactivo", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "pdf-row", statusRecordId: 7, isActive: false }))
        renderModal(pdf)
        const user = userEvent.setup()
        // El interruptor tiene nombre (antes no: su título era un Label sin htmlFor).
        await user.click(screen.getByRole("switch", { name: "Activa en esta unidad" }))
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "pdf-row", statusRecordId: 7, parameters: null,
        }))
    })

    it("con override, «Volver a heredar» lo borra y avisa al llamador", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        const handlers = renderModal({ ...pdf, override: override({ propertyAutomationUuid: "pdf-row" }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))
        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
        expect(handlers.onInheritRestored).toHaveBeenCalled()
    })

    it("si el borrado falla, la unidad conserva su override", async () => {
        mocks.deleteListingOverride.mockRejectedValue(new Error("HTTP 500"))
        const handlers = renderModal({ ...pdf, override: override({ propertyAutomationUuid: "pdf-row" }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))
        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
        expect(handlers.onInheritRestored).not.toHaveBeenCalled()
    })

    it("en borrador descarta el override sin llamar al servidor", async () => {
        const handlers = renderModal({ ...pdf, draftMode: true, override: override({ uuid: "", propertyAutomationUuid: "pdf-row" }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))
        await waitFor(() => expect(handlers.onInheritRestored).toHaveBeenCalled())
        expect(mocks.deleteListingOverride).not.toHaveBeenCalled()
    })
})

describe("AutomationOverrideModal — contrato por unidad (contrato 2026-10-19)", () => {
    const SIGNATURE: Provider = {
        ...provider(1005, "hitguest_signature"),
        parameters: { slug: "hitguest_signature", signature: { synchronous: true, contract_types: ["agreement_only"] } },
    }
    const CONTRACT: PropertyAutomation = {
        ...PDF,
        uuid: "contract-row",
        providerId: 1005,
        providerName: "hitguest_signature",
        provider: SIGNATURE,
        name: "Digital Signature",
        guestType: "main_guest",
        executionOrder: 10,
        parameters: { contract_mode: "all_sources", by_source: { all: { contract_type: "agreement_only", provider_slug: "hitguest_signature" } } },
    }
    const contract = { propertyAutomations: [CONTRACT], lockedPropertyAutomationUuid: "contract-row" }

    it("apagarlo dice que los huéspedes de la unidad no firmarán, y crea el override inactivo", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "contract-row", statusRecordId: 7, isActive: false }))
        renderModal(contract)
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        expect(screen.getByText("Los huéspedes de esta unidad no firmarán contrato.")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "contract-row", statusRecordId: 7, parameters: null,
        }))
    })

    it("cambiar el estado no pisa un ruteo propio de la unidad: el PATCH no manda `parameters`", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "contract-row", statusRecordId: 7, isActive: false }))
        renderModal({
            ...contract,
            override: override({
                propertyAutomationUuid: "contract-row",
                parameters: { contract_mode: "per_source", by_source: { 22: { contract_type: "agreement_only", provider_slug: "hitguest_signature" } } },
            }),
        })
        expect(screen.getByText("Esta unidad tiene su propio contrato por canal.")).toBeInTheDocument()
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-1", { statusRecordId: 7 }))
    })
})

describe("AutomationOverrideModal — identidad por unidad (contrato 2026-10-14)", () => {
    async function choose(label: RegExp) {
        const user = userEvent.setup()
        const option = await screen.findByRole("radio", { name: label })
        await waitFor(() => expect(option).toBeEnabled())
        await user.click(option)
        await user.click(screen.getByRole("button", { name: "Guardar" }))
    }

    it("muestra las cuatro opciones, sin interruptor, y Heredar dice qué usa la propiedad", async () => {
        renderModal()
        for (const name of [/Heredar/, /Verificación avanzada/, /Verificación esencial/, /Desactivar/]) {
            expect(await screen.findByRole("radio", { name })).toBeInTheDocument()
        }
        expect(screen.queryByRole("switch")).toBeNull()
        expect(screen.getByRole("radio", { name: /Heredar/ })).toBeChecked()
        expect(screen.getByText(/verificación avanzada\./)).toBeInTheDocument()
    })

    it("sin override, Esencial crea el override con el id del CATÁLOGO", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ providerId: 502, providerSource: "listing" }))
        const handlers = renderModal()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "identity-main", statusRecordId: 6, providerId: 502,
        }))
        expect(handlers.onSaved).toHaveBeenCalled()
    })

    it("de Avanzada propia a Esencial: PATCH solo con el proveedor", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ providerId: 502, providerSource: "listing" }))
        renderModal({ override: override({ providerId: 501, providerSource: "listing", effectiveProvider: { id: 501, name: "didit", slug: "didit", verificationType: "session" } }) })
        expect(await screen.findByRole("radio", { name: /Verificación avanzada/ })).toBeChecked()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-1", { providerId: 502 }))
    })

    it("de Desactivada a Esencial: DELETE y luego POST (el POST revive la fila)", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        mocks.createListingOverride.mockResolvedValue(override({ providerId: 502, providerSource: "listing" }))
        renderModal({ override: override({ statusRecordId: 7, isActive: false, providerSource: null }) })
        expect(await screen.findByRole("radio", { name: /Desactivar/ })).toBeChecked()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalled())
        expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1")
        expect(mocks.deleteListingOverride.mock.invocationCallOrder[0]).toBeLessThan(mocks.createListingOverride.mock.invocationCallOrder[0])
    })

    it("Desactivar sobre un override activo: PATCH con 7 y SIN proveedor", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ statusRecordId: 7, isActive: false, providerSource: null }))
        renderModal({ override: override({ providerId: 501, providerSource: "listing", effectiveProvider: { id: 501, name: null, slug: "didit", verificationType: "session" } }) })
        await choose(/Desactivar/)
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-1", { statusRecordId: 7 }))
    })

    it("Heredar con override: DELETE y la unidad vuelve a heredar", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        const handlers = renderModal({ override: override({ statusRecordId: 7, isActive: false, providerSource: null }) })
        await choose(/Heredar/)
        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
        expect(handlers.onInheritRestored).toHaveBeenCalled()
    })

    it("propiedad con la verificación apagada: Avanzada y Esencial deshabilitadas", async () => {
        renderModal({ propertyAutomations: [{ ...IDENTITY, isActive: false, statusProviderId: AUTOMATION_STATUS.INACTIVE }] })
        expect(await screen.findByRole("radio", { name: /Verificación avanzada/ })).toBeDisabled()
        expect(screen.getByRole("radio", { name: /Verificación esencial/ })).toBeDisabled()
        expect(screen.getAllByText(/la unidad no puede encender un nivel/).length).toBeGreaterThan(0)
        expect(screen.getByText(/solo suben fotos del documento\./)).toBeInTheDocument()
    })

    it("si el catálogo no carga, no se puede elegir un nivel y se ofrece Reintentar", async () => {
        mocks.listProviders.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([ADVANCED, ESSENTIAL])
        vi.spyOn(console, "error").mockImplementation(() => {})
        renderModal()
        const retry = await screen.findByRole("button", { name: /Reintentar/ })
        expect(screen.getByRole("radio", { name: /Verificación esencial/ })).toBeDisabled()
        await userEvent.setup().click(retry)
        await waitFor(() => expect(screen.getByRole("radio", { name: /Verificación esencial/ })).toBeEnabled())
    })

    it("un 422 en provider_id aparece junto al selector, tal cual", async () => {
        mocks.createListingOverride.mockRejectedValue(new ApiError(422, {
            message: "x", errors: { provider_id: ["El proveedor no aplica al país de la propiedad."] },
        }))
        renderModal()
        await choose(/Verificación esencial/)
        expect(await screen.findByText("El proveedor no aplica al país de la propiedad.")).toHaveAttribute("id", "identity-override-error")
    })

    it("un 422 por override duplicado relee los de la unidad y actualiza el existente", async () => {
        mocks.createListingOverride.mockRejectedValue(new ApiError(422, {
            message: "x", errors: { property_automation_uuid: ["Ya existe un override para esta unidad."] },
        }))
        mocks.listListingOverrides.mockResolvedValue([override({ uuid: "ov-existente", providerSource: "property" })])
        mocks.updateListingOverride.mockResolvedValue(override({ uuid: "ov-existente", providerId: 502, providerSource: "listing" }))
        const handlers = renderModal()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-existente", { providerId: 502 }))
        expect(mocks.listListingOverrides).toHaveBeenCalledWith("unit-1")
        expect(handlers.onSaved).toHaveBeenCalled()
    })

    it("en borrador, Esencial guarda el proveedor elegido sin llamar al servidor", async () => {
        const handlers = renderModal({ draftMode: true, listingUuid: "" })
        await choose(/Verificación esencial/)
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalledWith(expect.objectContaining({
            providerId: 502, providerSource: "listing", statusRecordId: 6,
        })))
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
    })

    it("sin cambios no llama al servidor", async () => {
        const handlers = renderModal()
        await choose(/Heredar/)
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(mocks.deleteListingOverride).not.toHaveBeenCalled()
        expect(handlers.onClose).toHaveBeenCalled()
    })
})

describe("AutomationOverrideModal — TRA con credenciales por alojamiento (contrato 2026-11-10)", () => {
    const traListing = withCredentials("tra-row", "tra_colombia", { credentials_scope: "listing", token: "SENTINEL-TRA-TOKEN" })
    const props = { propertyAutomations: [traListing], lockedPropertyAutomationUuid: "tra-row" }

    it("no habla de herencia ni usa los valores de la propiedad como pista", () => {
        renderModal(props)
        const dialog = screen.getByRole("dialog")
        expect(dialog).toHaveTextContent("Se reporta con sus credenciales")
        expect(dialog).toHaveTextContent(/Sin ellas, sus reservas no se reportan/)
        expect(dialog.textContent).not.toMatch(/hered/i)
        expect(screen.queryByPlaceholderText("Usa el valor de la propiedad")).toBeNull()
        expect(dialog.outerHTML).not.toMatch(/SENTINEL/)
    })

    it("guardar un alojamiento nuevo sin credenciales marca los campos, enfoca el primero y no cierra", async () => {
        const handlers = renderModal(props)
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        const errors = screen.getAllByText("Este campo es obligatorio para reportar este alojamiento.")
        expect(errors).toHaveLength(2)
        const token = screen.getByLabelText(/Token API TRA/)
        expect(token).toHaveAttribute("aria-invalid", "true")
        expect(token).toHaveAttribute("aria-describedby", expect.stringContaining(errors[0].id))
        await waitFor(() => expect(token).toHaveFocus())
        expect(handlers.onClose).not.toHaveBeenCalled()
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
    })

    it("el dueño (el valor llegó) ve su secreto en un campo de contraseña y no se reenvía si no lo cambia", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({
            propertyAutomationUuid: "tra-row",
            credentialsComplete: true,
            parameters: { rnt: "123" },
        }))
        renderModal({
            ...props,
            override: override({
                propertyAutomationUuid: "tra-row",
                credentialsComplete: true,
                storedSecretKeys: ["token"],
                secretHints: {},
                parameters: { token: "SENTINEL-OVERRIDE-TOKEN", rnt: "123" },
            }),
        })
        const token = screen.getByLabelText(/Token API TRA/)
        // Decisión 2026-11-14 (sugerencia del backend): el dueño lo ve, enmascarado y con mostrar/ocultar.
        expect(token).toHaveAttribute("type", "password")
        expect(token).toHaveValue("SENTINEL-OVERRIDE-TOKEN")
        expect(screen.getByRole("button", { name: /Mostrar/i })).toBeInTheDocument()

        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalled())
        const payload = mocks.updateListingOverride.mock.calls[0][1]
        // Sin cambio no se reenvía: el backend conserva el guardado (nota 2026-11-12 §4).
        expect(payload.parameters).toEqual({ rnt: "123" })
        expect(JSON.stringify(payload)).not.toContain("SENTINEL-OVERRIDE-TOKEN")
    })

    it("quien no es el dueño (guardado sin valor) ve «Guardada» con la pista, sin campo ni forma de pisarlo", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "tra-row", credentialsComplete: true }))
        renderModal({
            ...props,
            override: override({
                propertyAutomationUuid: "tra-row",
                credentialsComplete: true,
                storedSecretKeys: ["token"],
                secretHints: { token: "3f9a" },
                parameters: { rnt: "123" },
            }),
        })
        expect(screen.queryByLabelText(/Token API TRA/, { selector: "input" })).toBeNull()
        expect(screen.getByText("••••3f9a · Guardada")).toBeInTheDocument()
        expect(screen.getByText("Solo el dueño de la propiedad puede verla o cambiarla.")).toBeInTheDocument()
        // Guardar no le exige el token ni lo manda: el backend conserva el suyo.
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalled())
        expect(mocks.updateListingOverride.mock.calls[0][1].parameters).toEqual({ rnt: "123" })
    })

    it("escribir en un secreto y borrarlo lo conserva: vacío nunca se envía como null", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "tra-row", credentialsComplete: true }))
        renderModal({
            ...props,
            override: override({
                propertyAutomationUuid: "tra-row",
                credentialsComplete: true,
                parameters: { token: "SENTINEL-OVERRIDE-TOKEN", rnt: "123" },
            }),
        })
        const user = userEvent.setup()
        const token = screen.getByLabelText(/Token API TRA/)
        await user.type(token, "abc")
        await user.clear(token)
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalled())
        const payload = mocks.updateListingOverride.mock.calls[0][1]
        expect(payload.parameters).toEqual({ rnt: "123" })
        expect("token" in payload.parameters).toBe(false)
    })

    it("reabrir un borrador y guardar sin tocar el secreto lo arrastra (no se pierde antes del POST)", async () => {
        const handlers = renderModal({
            ...props,
            draftMode: true,
            override: override({ uuid: "", propertyAutomationUuid: "tra-row", parameters: { token: "SENTINEL-DRAFT-TOKEN", rnt: "123" } }),
        })
        // El borrador es del PM que lo escribe: lo ve enmascarado, como el dueño.
        const token = screen.getByLabelText(/Token API TRA/)
        expect(token).toHaveAttribute("type", "password")
        expect(token).toHaveValue("SENTINEL-DRAFT-TOKEN")
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(handlers.onSaved.mock.calls[0][0].parameters).toEqual({ token: "SENTINEL-DRAFT-TOKEN", rnt: "123" })
    })

    it("una clave faltante que el modal no muestra no bloquea el guardado en silencio", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "tra-row" }))
        renderModal({
            ...props,
            override: override({
                propertyAutomationUuid: "tra-row",
                credentialsComplete: false,
                missingCredentialKeys: ["foo"],
                parameters: { rnt: "123" },
            }),
        })
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        // Sin campo que marcar, el guardado sigue y el backend valida (422 por clave).
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalled())
        expect(screen.queryByText("Este campo es obligatorio para reportar este alojamiento.")).toBeNull()
    })

    it("una clave faltante en camelCase marca su campo", async () => {
        renderModal({
            ...props,
            override: override({
                propertyAutomationUuid: "tra-row",
                credentialsComplete: false,
                missingCredentialKeys: ["rnt"],
                parameters: {},
            }),
        })
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        expect(await screen.findByText("Este campo es obligatorio para reportar este alojamiento.")).toBeInTheDocument()
        expect(screen.getByLabelText(/RNT \(Registro/)).toHaveAttribute("aria-invalid", "true")
        expect(mocks.updateListingOverride).not.toHaveBeenCalled()
    })

    it("el campo secreto no invita al gestor de contraseñas a rellenarlo con el login de HIT", () => {
        renderModal(props)
        const token = screen.getByLabelText(/Token API TRA/)
        expect(token).toHaveAttribute("autocomplete", "new-password")
        expect(token).toHaveAttribute("data-1p-ignore")
        expect(token).toHaveAttribute("data-lpignore", "true")
        expect(token).toHaveAttribute("aria-required", "true")
    })

    it("un 422 de credenciales se muestra en su campo y no como toast genérico", async () => {
        mocks.createListingOverride.mockRejectedValue(new ApiError(422, {
            message: "Credenciales incompletas",
            errors: { "parameters.rnt": ["El RNT es obligatorio para este alojamiento."] },
        }))
        renderModal(props)
        const user = userEvent.setup()
        await user.type(screen.getByLabelText(/Token API TRA/), "token-nuevo")
        await user.type(screen.getByLabelText(/RNT \(Registro/), "123")
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        const error = await screen.findByText("El RNT es obligatorio para este alojamiento.")
        const rnt = screen.getByLabelText(/RNT \(Registro/)
        expect(rnt).toHaveAttribute("aria-invalid", "true")
        expect(rnt).toHaveAttribute("aria-describedby", expect.stringContaining(error.id))
        expect(mocks.toast.error).not.toHaveBeenCalled()
    })

    it("apagarlo es excluir: crea el override inactivo", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "tra-row", statusRecordId: 7, isActive: false }))
        renderModal(props)
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        expect(screen.getByRole("dialog")).toHaveTextContent("Excluido: no se reporta")
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith(
            expect.objectContaining({ propertyAutomationUuid: "tra-row", statusRecordId: 7 }),
        ))
    })

    it("con override, borrarlo es «Quitar credenciales» y avisa que deja de reportarse", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        const handlers = renderModal({ ...props, override: override({ propertyAutomationUuid: "tra-row", parameters: { rnt: "1" } }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Quitar credenciales" }))
        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
        expect(mocks.toast.success).toHaveBeenCalledWith("Credenciales quitadas. Este alojamiento ya no se reporta.")
        expect(handlers.onInheritRestored).toHaveBeenCalled()
    })
})

describe("AutomationOverrideModal — SIRE: las credenciales se piden una vez (nota backend 2026-11-12, Q4)", () => {
    const sireIn = { ...withCredentials("sire-in", "sire_colombia", { credentials_scope: "listing" }), name: "SIRE Colombia - Check-in" }
    const sireOut = { ...withCredentials("sire-out", "sire_colombia", { credentials_scope: "listing" }), name: "SIRE Colombia - Check-out" }
    const creds = { document_type: "CC", document_number: "1020", password: "SENTINEL-SIRE-PASS" }
    const existing = () => override({
        propertyAutomationUuid: "sire-in", credentialsComplete: true, storedSecretKeys: ["password"], parameters: { ...creds },
    })
    const base = () => ({
        propertyAutomations: [sireIn],
        lockedPropertyAutomationUuid: "sire-in",
        override: existing(),
        credentialSibling: { automation: sireOut, override: null },
        onSiblingSaved: vi.fn(),
    })

    // La copia relee el override de la otra al guardar: por omisión, la unidad no tiene ninguno.
    beforeEach(() => { mocks.listListingOverrides.mockResolvedValue([]) })

    it("ofrece guardar en la otra SIRE (marcado) y copia todo lo del formulario, incluido el secreto del dueño", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "sire-out", parameters: { document_number: "1020" } }))
        const props = base()
        const handlers = renderModal(props)
        const mirror = screen.getByRole("checkbox", { name: /Usar estas mismas credenciales en «SIRE Colombia - Check-out»/ })
        expect(mirror).toHaveAttribute("aria-checked", "true")

        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        // La principal no reenvía el secreto sin cambio…
        expect(mocks.updateListingOverride.mock.calls[0][1].parameters).toEqual({ document_type: "CC", document_number: "1020" })
        // …y la otra SIRE recibe las credenciales completas, activa.
        expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "sire-out", statusRecordId: 6, parameters: creds,
        })
        expect(props.onSiblingSaved).toHaveBeenCalledWith(expect.objectContaining({ propertyAutomationUuid: "sire-out" }))
        expect(mocks.toast.success).toHaveBeenCalledWith("Credenciales guardadas aquí y en «SIRE Colombia - Check-out»")
    })

    it("si la otra ya tiene credenciales propias, reemplazarlas es opt-in; marcado, la actualiza y vacía lo que aquí está vacío", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        const outOverride = override({
            uuid: "ov-out", propertyAutomationUuid: "sire-out",
            parameters: { document_type: "CC", document_number: "999", company_code: "NIT1" }, storedSecretKeys: ["password"],
        })
        // La relectura al guardar la encuentra igual.
        mocks.listListingOverrides.mockResolvedValue([outOverride])
        const props = { ...base(), credentialSibling: { automation: sireOut, override: outOverride } }
        renderModal(props)
        const replace = screen.getByRole("checkbox", { name: /Reemplazar las credenciales de «SIRE Colombia - Check-out» con estas/ })
        expect(replace).toHaveAttribute("aria-checked", "false")

        const user = userEvent.setup()
        await user.click(replace)
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledTimes(2))
        // «Las mismas»: el NIT que aquí no hay se vacía allá; el secreto no se toca si estaba vacío.
        // Sin `statusRecordId`: ya se comprobó activa; un estado mal leído no reactiva nada.
        expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-out", {
            parameters: { ...creds, company_code: null },
        })
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
    })

    it("la otra se relee al guardar: si la excluyeron en otra tarjeta, no se reactiva", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        mocks.listListingOverrides.mockResolvedValue([
            override({ uuid: "ov-out", propertyAutomationUuid: "sire-out", statusRecordId: 7, isActive: false }),
        ])
        const props = base()
        const handlers = renderModal(props)
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(mocks.updateListingOverride).toHaveBeenCalledTimes(1)
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining("está excluida en este alojamiento"))
    })

    it("quien no ve la contraseña no puede copiar: no se ofrece (la otra quedaría con documento de una y clave de otra)", () => {
        renderModal({
            ...base(),
            override: override({
                propertyAutomationUuid: "sire-in", credentialsComplete: true, storedSecretKeys: ["password"],
                parameters: { document_type: "CC", document_number: "1020" },
            }),
        })
        expect(screen.getByText("•••••••• · Guardada")).toBeInTheDocument()
        expect(screen.queryByRole("checkbox", { name: /credenciales/ })).toBeNull()
    })

    it("con un backend anterior a la nota, un secreto que llega (quizá enmascarado) no se precarga ni se copia", () => {
        renderModal({
            ...base(),
            override: override({
                propertyAutomationUuid: "sire-in", credentialsComplete: true,
                parameters: { document_type: "CC", document_number: "1020", password: "********" },
            }),
        })
        expect(screen.getByLabelText(/Contraseña/, { selector: "input" })).toHaveValue("")
        expect(screen.queryByRole("checkbox", { name: /credenciales/ })).toBeNull()
    })

    it("desmarcado, solo se guarda esta", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        const props = base()
        const handlers = renderModal(props)
        const user = userEvent.setup()
        await user.click(screen.getByRole("checkbox", { name: /Usar estas mismas credenciales/ }))
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(props.onSiblingSaved).not.toHaveBeenCalled()
    })

    it("si falla la otra, la principal queda guardada y se dice qué no se guardó", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        mocks.createListingOverride.mockRejectedValue(new ApiError(500, { message: "Servidor caído" }))
        const props = base()
        const handlers = renderModal(props)
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(mocks.toast.warning).toHaveBeenCalledWith(expect.stringContaining("pero no en «SIRE Colombia - Check-out»"))
        // El aviso ya dice qué se guardó: sin un «guardado» encima que lo contradiga.
        expect(mocks.toast.success).not.toHaveBeenCalled()
        expect(props.onSiblingSaved).not.toHaveBeenCalled()
    })

    it("no se ofrece si la otra SIRE está excluida en esta unidad (copiar la reactivaría)", () => {
        renderModal({ ...base(), credentialSibling: { automation: sireOut, override: override({ propertyAutomationUuid: "sire-out", statusRecordId: 7, isActive: false }) } })
        expect(screen.queryByRole("checkbox", { name: /Usar estas mismas credenciales/ })).toBeNull()
    })

    it("si el panel estaba viejo y la otra YA tiene credenciales, no las reemplaza en silencio", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        // El panel la cargó sin override («Usar…», marcado); al guardar ya tiene las suyas.
        mocks.listListingOverrides.mockResolvedValue([override({
            uuid: "ov-out", propertyAutomationUuid: "sire-out",
            parameters: { document_type: "CE", document_number: "999" }, storedSecretKeys: ["password"],
        })])
        const handlers = renderModal(base())
        expect(screen.getByRole("checkbox", { name: /Usar estas mismas credenciales/ })).toHaveAttribute("aria-checked", "true")
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(mocks.updateListingOverride).toHaveBeenCalledTimes(1)
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining("ya tiene credenciales propias"))
        expect(mocks.toast.success).not.toHaveBeenCalled()
    })

    it("si la otra se creó después de abrir el panel (sin credenciales), la actualiza en vez de duplicarla", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        mocks.listListingOverrides.mockResolvedValue([override({ uuid: "ov-out", propertyAutomationUuid: "sire-out", parameters: {} })])
        renderModal(base())
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledTimes(2))
        expect(mocks.updateListingOverride).toHaveBeenLastCalledWith("ov-out", { parameters: creds })
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
    })

    it("si el dueño vacía su contraseña (se conserva aquí), a la otra se copia la guardada", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "sire-out" }))
        renderModal(base())
        const user = userEvent.setup()
        await user.clear(screen.getByLabelText(/Contraseña/, { selector: "input" }))
        expect(screen.getByText("Ya configurado; déjalo vacío para conservarlo.")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalled())
        expect(mocks.createListingOverride.mock.calls[0][0].parameters).toEqual(creds)
        expect(mocks.toast.warning).not.toHaveBeenCalled()
    })

    it("sin una credencial obligatoria no copia nada a la otra, y dice qué sí se guardó", async () => {
        mocks.updateListingOverride.mockResolvedValue(existing())
        const handlers = renderModal(base())
        const user = userEvent.setup()
        await user.clear(screen.getByLabelText(/Número de documento/i, { selector: "input" }))
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(mocks.toast.warning).toHaveBeenCalledWith(expect.stringMatching(/^Se guardó en esta automatización, pero no se copiaron .*faltan .*documento/i))
    })

    it("en borrador (unidad nueva) sintetiza el override de la otra sin llamar al servidor", async () => {
        const props = { ...base(), draftMode: true, override: override({ uuid: "", propertyAutomationUuid: "sire-in", parameters: { ...creds } }) }
        const handlers = renderModal(props)
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled())
        expect(props.onSiblingSaved).toHaveBeenCalledWith(expect.objectContaining({
            uuid: "", propertyAutomationUuid: "sire-out", statusRecordId: 6, isActive: true, parameters: creds,
        }))
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(mocks.updateListingOverride).not.toHaveBeenCalled()
    })
})
