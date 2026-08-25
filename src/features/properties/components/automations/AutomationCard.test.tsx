import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AutomationCard } from "./AutomationCard"
import { AUTOMATION_DEFINITIONS } from "../../data/automation-definitions"
import { AUTOMATION_STATUS, type PropertyAutomation, type Provider } from "../../types/automation"

/** El contrato es opcional; las automations disponibles para el país las crea el PM. */

const create = vi.fn()
const toggle = vi.fn()
const configure = vi.fn()

vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return {
        ...actual,
        automationService: {
            create: (...args: unknown[]) => create(...args),
            toggle: (...args: unknown[]) => toggle(...args),
            configure: (...args: unknown[]) => configure(...args),
        },
    }
})

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function makeProvider(id: number, slug: string): Provider {
    return {
        id,
        name: slug,
        description: null,
        parameters: {
            slug,
            internalUse: { path: slug },
            billing: { billable: false, unit_cost: 0 },
        },
        order: 1,
        statusProviderId: 8,
    }
}

function makeAutomation(overrides: Partial<PropertyAutomation> = {}): PropertyAutomation {
    return {
        uuid: "row-uuid",
        propertyUuid: "property-1",
        providerId: null,
        name: "Automation",
        guestType: "all",
        executionOrder: 1,
        parameters: {},
        token: null,
        statusProviderId: AUTOMATION_STATUS.INACTIVE,
        deletedAt: null,
        isActive: false,
        ...overrides,
    }
}

/** La definición de presentación, tal como se la pasa `PropertiesAutomation`. */
function definitionFor(definitionId: string) {
    const definition = AUTOMATION_DEFINITIONS.find((d) => d.id === definitionId)
    if (!definition) throw new Error(`No existe la definición "${definitionId}"`)
    return definition
}

const baseProps = {
    propertyUuid: "property-1",
    listings: [],
    onChanged: vi.fn(),
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe("AutomationCard sin fila en el backend", () => {
    it("permite al PM activar y configurar una automation disponible para el país", () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("tra-colombia")}
                automation={null}
                providers={[makeProvider(1, "tra-colombia")]}
            />,
        )

        expect(screen.getByText("TRA Colombia")).toBeInTheDocument()
        expect(screen.queryByText(/todavía no está creada para ella/i)).not.toBeInTheDocument()
        expect(screen.getByRole("switch")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Configurar/i })).toBeInTheDocument()
    })

    it("permite elegir proveedor antes de crear una automation inexistente", () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("identity-verification-secondary")}
                automation={null}
                providers={[makeProvider(1000, "didit"), makeProvider(1004, "textract")]}
            />,
        )

        expect(screen.getByRole("combobox")).toBeInTheDocument()
        expect(screen.getByRole("switch")).toBeInTheDocument()
    })

    it("crea la fila inactiva y luego la activa", async () => {
        const created = makeAutomation({ uuid: "new-row", providerId: 1 })
        const active = makeAutomation({
            uuid: "new-row",
            providerId: 1,
            statusProviderId: AUTOMATION_STATUS.ACTIVE,
            isActive: true,
        })
        create.mockResolvedValue(created)
        toggle.mockResolvedValue(active)
        const definition = {
            ...definitionFor("identity-verification-main"),
            providerOptions: [definitionFor("identity-verification-main").providerOptions[0]],
        }

        render(
            <AutomationCard
                {...baseProps}
                definition={definition}
                automation={null}
                providers={[makeProvider(1, "didit")]}
            />,
        )

        fireEvent.click(screen.getByRole("switch"))

        await waitFor(() => expect(create).toHaveBeenCalledWith({
            propertyUuid: "property-1",
            providerId: 1,
            name: "Verificación de Identidad (Principal)",
            guestType: "main_guest",
            executionOrder: 1,
            parameters: {},
            statusProviderId: AUTOMATION_STATUS.INACTIVE,
        }))
        expect(toggle).toHaveBeenCalledWith("new-row", true, 1)
        expect(baseProps.onChanged).toHaveBeenCalledWith(active)
    })

    it("crea y configura una automation operativa desde el modal", async () => {
        const created = makeAutomation({
            uuid: "pdf-row",
            providerId: 1003,
            name: "Reporte PDF de Huéspedes",
            executionOrder: 30,
            providerName: "pdf_report",
        })
        const active = makeAutomation({
            ...created,
            statusProviderId: AUTOMATION_STATUS.ACTIVE,
            isActive: true,
        })
        create.mockResolvedValue(created)
        configure.mockResolvedValue(active)

        render(
            <AutomationCard
                {...baseProps}
                definition={{ ...definitionFor("guest-report-pdf"), order: 30 }}
                automation={null}
                providers={[makeProvider(1003, "pdf_report")]}
            />,
        )

        fireEvent.click(screen.getByRole("button", { name: /Configurar/i }))
        fireEvent.click(screen.getByRole("button", { name: /Agregar destinatarios/i }))
        fireEvent.change(screen.getByPlaceholderText("destino@email.com"), {
            target: { value: "ops@example.com" },
        })
        fireEvent.click(screen.getByLabelText("Al completar el check-in"))
        fireEvent.click(screen.getByRole("button", { name: /Guardar Configuración/i }))

        await waitFor(() => expect(create).toHaveBeenCalledWith({
            propertyUuid: "property-1",
            providerId: 1003,
            name: "Reporte PDF de Huéspedes",
            guestType: "all",
            executionOrder: 30,
            parameters: {},
            statusProviderId: AUTOMATION_STATUS.INACTIVE,
        }))
        expect(configure).toHaveBeenCalledWith("pdf-row", {
            statusProviderId: AUTOMATION_STATUS.ACTIVE,
            providerId: 1003,
            parameters: {
                recipients: ["ops@example.com"],
                triggerTypes: ["on_checkin_completed"],
                triggerConfig: {},
            },
        })
        expect(baseProps.onChanged).toHaveBeenCalledWith(active)
    })
})

describe("AutomationCard — Contrato", () => {
    /**
     * "Quién firma" tiene UNA sola fuente: `parameters.by_source[canal].provider_slug`,
     * que se configura en Documentos filtrado por `contract_types`. Un selector
     * propio acá escribía otro campo (`provider_id`), no cambiaba quién firma de
     * verdad, y ofrecía la firma nativa para una garantía — combinación que el
     * backend rechaza con 422.
     */
    const contractDefinition = () => definitionFor("digital-contract")

    const signedProvider = (): Provider => {
        const provider = makeProvider(1002, "tufirma")
        return { ...provider, name: "TuFirma Digital" }
    }

    const routedContract = (overrides: Partial<PropertyAutomation> = {}) => makeAutomation({
        uuid: "contract-row",
        providerId: 1002,
        parameters: {
            contract_mode: "all_sources",
            by_source: { all: { contract_type: "agreement_only", provider_slug: "tufirma" } },
        },
        ...overrides,
    })

    it("no ofrece su propio selector de proveedor", () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={routedContract()}
                providers={[signedProvider()]}
            />,
        )

        expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
        expect(screen.queryByText("HIT Guest — Firma Nativa")).not.toBeInTheDocument()
    })

    it("refleja el routing configurado en vez de volver a preguntarlo", () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={routedContract({ isActive: true, statusProviderId: AUTOMATION_STATUS.ACTIVE })}
                providers={[signedProvider()]}
            />,
        )

        expect(
            screen.getByText("Todos los canales · Contrato de alquiler · TuFirma Digital"),
        ).toBeInTheDocument()
    })

    const perSourceContract = () => makeAutomation({
        uuid: "contract-row",
        providerId: 1002,
        isActive: true,
        parameters: {
            contract_mode: "per_source",
            by_source: {
                "22": { contract_type: "agreement_only", provider_slug: "hitguest_signature" },
                "23": { contract_type: "guarantee_only", provider_slug: "tufirma" },
            },
        },
    })

    const sourceCatalog = () => [
        { id: 22, catalogCategoryId: 1, name: "Airbnb", order: 1, status: "active" },
        { id: 23, catalogCategoryId: 1, name: "Booking.com", order: 2, status: "active" },
    ]

    it("enumera canal, tipo y firmante de cada canal configurado", () => {
        // "N canales configurados" no le decía al PM QUÉ tiene activo — este es
        // el caso de Insula: canal + tipo de contrato + firmante, por línea.
        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={perSourceContract()}
                providers={[signedProvider()]}
                sources={sourceCatalog()}
            />,
        )

        expect(screen.getByText("Airbnb · Contrato de alquiler · hitguest_signature")).toBeInTheDocument()
        expect(screen.getByText("Booking.com · Contrato de garantía · TuFirma Digital")).toBeInTheDocument()
    })

    it("sin catálogo de canales muestra el id crudo en vez de ocultar el routing", () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={perSourceContract()}
                providers={[signedProvider()]}
            />,
        )

        expect(screen.getByText(/Canal 22 · Contrato de alquiler/)).toBeInTheDocument()
        expect(screen.getByText(/Canal 23 · Contrato de garantía/)).toBeInTheDocument()
    })

    it("activa sin routing: lo dice con sus consecuencias, no un 'sin configurar' neutro", () => {
        // Estado inalcanzable por esta UI (el toggle exige routing para
        // encender) — la fila se activó por otro camino (backend/import). El
        // patrón ACTIVO + SIN CONFIGURAR ya costó un incidente (2026-08-15).
        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={makeAutomation({
                    uuid: "contract-row",
                    providerId: 1002,
                    isActive: true,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    parameters: {},
                })}
                providers={[signedProvider()]}
            />,
        )

        expect(screen.getByText(/completan su check-in sin contrato/)).toBeInTheDocument()
    })

    it("sin routing manda a Documentos en vez de encender una firma que no sabe qué firmar", async () => {
        const onNavigateToDocuments = vi.fn()

        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={makeAutomation({ uuid: "contract-row", providerId: 1002, parameters: {} })}
                providers={[signedProvider()]}
                onNavigateToDocuments={onNavigateToDocuments}
            />,
        )

        fireEvent.click(screen.getByRole("switch"))

        await waitFor(() => expect(onNavigateToDocuments).toHaveBeenCalledTimes(1))
        expect(toggle).not.toHaveBeenCalled()
    })

    it("se puede apagar: el contrato ya no es obligatorio", async () => {
        // Estuvo bloqueada por el "Frontend API Integration Plan" §6, que dice que
        // desactivarla devuelve 422. El backend confirmó que esa regla ya no
        // aplica — el contrato es opt-in. Los slots de identidad también pueden
        // desactivarse; su obligatoriedad significa que las filas siempre existen.
        toggle.mockResolvedValue(makeAutomation({ isActive: false }))

        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={routedContract({
                    isActive: true,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    executionOrder: 10,
                })}
                providers={[signedProvider()]}
            />,
        )

        const toggleSwitch = screen.getByRole("switch")
        expect(toggleSwitch).not.toBeDisabled()
        expect(screen.queryByText("Obligatorio")).not.toBeInTheDocument()

        fireEvent.click(toggleSwitch)
        await waitFor(() => expect(toggle).toHaveBeenCalledWith("contract-row", false, 1002))
    })

    it("con routing configurado el switch sí enciende la fila existente", async () => {
        toggle.mockResolvedValue(makeAutomation({ isActive: true }))

        render(
            <AutomationCard
                {...baseProps}
                definition={contractDefinition()}
                automation={routedContract()}
                providers={[signedProvider()]}
            />,
        )

        fireEvent.click(screen.getByRole("switch"))

        await waitFor(() => expect(toggle).toHaveBeenCalledWith("contract-row", true, 1002))
        expect(create).not.toHaveBeenCalled()
    })
})

describe("AutomationCard con fila existente", () => {
    it("sigue usando toggle y nunca crea una fila", async () => {
        toggle.mockResolvedValue(makeAutomation({ isActive: true }))

        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("tra-colombia")}
                automation={makeAutomation({
                    uuid: "row-uuid",
                    providerId: 1,
                    executionOrder: 6,
                    parameters: { token: "x", rnt: "y", triggerTypes: ["on_checkin_completed"] },
                    provider: makeProvider(1, "tra-colombia"),
                })}
                providers={[makeProvider(1, "tra-colombia")]}
            />,
        )

        fireEvent.click(screen.getByRole("switch"))

        await waitFor(() => expect(toggle).toHaveBeenCalledWith("row-uuid", true, 1))
        expect(create).not.toHaveBeenCalled()
    })

    it("no activa una automation operativa sin trigger; abre configuración", async () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("tra-colombia")}
                automation={makeAutomation({
                    uuid: "tra-sin-trigger",
                    providerId: 1,
                    executionOrder: 40,
                    parameters: { token: "x", rnt: "y" },
                    provider: makeProvider(1, "tra-colombia"),
                })}
                providers={[makeProvider(1, "tra-colombia")]}
            />,
        )

        fireEvent.click(screen.getByRole("switch"))

        expect(await screen.findByText(/Selecciona al menos un disparador/i)).toBeInTheDocument()
        expect(toggle).not.toHaveBeenCalled()
    })

    it("una automatización normal activa sí se puede desactivar", async () => {
        // El bloqueo es exclusivo de la firma: cerrarlo de más dejaría al PM sin
        // poder apagar TRA, SIRE o el reporte PDF.
        toggle.mockResolvedValue(makeAutomation({ isActive: false }))

        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("tra-colombia")}
                automation={makeAutomation({
                    uuid: "tra-row",
                    providerId: 1,
                    executionOrder: 40,
                    isActive: true,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    parameters: { token: "x", rnt: "y" },
                })}
                providers={[makeProvider(1, "tra-colombia")]}
            />,
        )

        expect(screen.getByRole("switch")).not.toBeDisabled()
        fireEvent.click(screen.getByRole("switch"))
        await waitFor(() => expect(toggle).toHaveBeenCalledWith("tra-row", false, 1))
    })
})

describe("AutomationCard — verificación de identidad", () => {
    it("no ofrece desactivar un slot de identidad activo que el backend protege", () => {
        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("identity-verification-main")}
                automation={makeAutomation({
                    uuid: "identity-row",
                    providerId: 1000,
                    executionOrder: 1,
                    guestType: "main_guest",
                    isActive: true,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    provider: makeProvider(1000, "didit"),
                })}
                providers={[makeProvider(1000, "didit")]}
            />,
        )

        const toggleSwitch = screen.getByRole("switch")
        expect(toggleSwitch).toBeDisabled()
        expect(screen.getByText("Obligatorio")).toBeInTheDocument()
        expect(toggle).not.toHaveBeenCalled()
    })

    it("un slot de identidad INACTIVO sí se puede activar", async () => {
        // Al activar, se reusa la fila estructural que el backend creó y se envía
        // el provider elegido por el PM.
        toggle.mockResolvedValue(makeAutomation({ isActive: true }))

        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("identity-verification-main")}
                automation={makeAutomation({
                    uuid: "identity-row",
                    providerId: 1000,
                    executionOrder: 1,
                    guestType: "main_guest",
                    provider: makeProvider(1000, "didit"),
                })}
                providers={[makeProvider(1000, "didit")]}
            />,
        )

        expect(screen.getByRole("switch")).not.toBeDisabled()
        fireEvent.click(screen.getByRole("switch"))
        await waitFor(() => expect(toggle).toHaveBeenCalledWith("identity-row", true, 1000))
    })

    it("una automatización NO de identidad con orden bajo sí se puede apagar", async () => {
        // El orden solo no alcanza como criterio: una fila legacy o a medida puede
        // quedar en el 1 o el 2 sin ser de identidad, y bloquearla la dejaría
        // encendida para siempre. Lo que la distingue es `guest_type` ≠ "all"
        // JUNTO con el orden.
        toggle.mockResolvedValue(makeAutomation({ isActive: false }))

        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("guest-report-pdf")}
                automation={makeAutomation({
                    uuid: "legacy-row",
                    providerId: 1003,
                    executionOrder: 2,
                    guestType: "all",
                    isActive: true,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    parameters: { recipients: ["ops@x.com"] },
                })}
                providers={[makeProvider(1003, "pdf_report")]}
            />,
        )

        expect(screen.getByRole("switch")).not.toBeDisabled()
        fireEvent.click(screen.getByRole("switch"))
        await waitFor(() => expect(toggle).toHaveBeenCalledWith("legacy-row", false, 1003))
    })
})

describe("AutomationCard — protección SIRE", () => {
    it("persiste guest_filter=foreign_only aunque el valor guardado fuera all", async () => {
        const sire = makeProvider(2, "sire_colombia")
        configure.mockResolvedValue(makeAutomation({ isActive: true }))

        render(
            <AutomationCard
                {...baseProps}
                definition={definitionFor("sire-colombia-checkin")}
                automation={makeAutomation({
                    uuid: "sire-row",
                    providerId: 2,
                    provider: sire,
                    providerName: "sire_colombia",
                    executionOrder: 50,
                    parameters: {
                        document_type: "PA",
                        document_number: "123",
                        password: "secret",
                        guest_filter: "all",
                        triggerTypes: ["on_guest_checkin_completed"],
                    },
                })}
                providers={[sire]}
            />,
        )

        fireEvent.click(screen.getByRole("button", { name: "Configurar" }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar Configuración" }))

        await waitFor(() => expect(configure).toHaveBeenCalledWith(
            "sire-row",
            expect.objectContaining({
                statusProviderId: AUTOMATION_STATUS.ACTIVE,
                parameters: expect.objectContaining({ guest_filter: "foreign_only" }),
            }),
        ))
    })
})
