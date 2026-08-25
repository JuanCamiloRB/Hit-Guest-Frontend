/**
 * Catálogo de automatizaciones de una propiedad.
 *
 * ## El problema que resuelve
 *
 * La pestaña de Automatizaciones era un espejo 1:1 de
 * `GET /properties/{uuid}/automations`, y el backend dejó de auto-crear las
 * filas que el cliente no mandó al crear la propiedad. Resultado: en una
 * propiedad nueva solo existen las dos de
 * identidad, y TTLock, Reporte PDF, TRA, SIRE y la firma eran INVISIBLES — el
 * PM no tenía forma de enterarse de que existían.
 *
 * ## De dónde sale "qué aplica a esta propiedad"
 *
 * De `GET /providers?country={ISO2}`: filtra por `parameters.applicable_countries`
 * y cada provider trae `parameters.default_setup.slots[]` con el nombre, el
 * orden, el `guest_type`, el estado inicial y las claves de parámetros de cada
 * fila que le corresponde. Ese es el contrato, y es el que manda.
 *
 * Antes esto estaba escrito a mano en `AUTOMATION_DEFINITIONS` y **no
 * coincidía**: los `executionOrder` reales son 10/20/30/40/50/51, no 1..8.
 *
 * ## Qué sigue siendo del frontend
 *
 * `AUTOMATION_DEFINITIONS` queda como capa de PRESENTACIÓN: ícono, color,
 * descripción, título en español y el esquema de formulario (etiqueta, tipo y
 * placeholder de cada campo). El backend dice QUÉ hay y con qué claves; el
 * frontend, cómo se ve. Una clave que el backend pida y no esté en el esquema se
 * renderiza igual, como texto — nunca se descarta en silencio.
 *
 * Sin React y sin fetch: se puede probar entero.
 */

import { AUTOMATION_DEFINITIONS, definitionForAutomation } from "../data/automation-definitions"
import { canonicalSlug } from "../services/automation-service"
import type {
    AutomationDefinition,
    ParameterFieldSchema,
    PropertyAutomation,
    Provider,
    ProviderSetupSlot,
} from "../types/automation"

export interface AutomationSlot {
    /** Clave estable de React: uuid de la fila, o provider+orden si aún no existe. */
    key: string
    definition: AutomationDefinition
    /** `null` = aplica al país pero el backend todavía no tiene la fila. */
    automation: PropertyAutomation | null
}

/**
 * Vincula opciones de presentación con los providers reales del país. Los IDs
 * no son constantes públicas: siempre salen de `GET /providers?country=`. Una
 * opción actualmente configurada se conserva aunque el provider luego quede
 * inactivo, para que el selector no pierda el valor guardado.
 */
export function bindCatalogProviders(
    definition: AutomationDefinition,
    automation: PropertyAutomation | null,
    providers: Provider[],
    countryProviderSlugs: string[],
): AutomationDefinition {
    const available = new Set(countryProviderSlugs.map(canonicalSlug))
    const currentSlug = canonicalSlug(
        automation?.provider?.parameters?.slug ?? automation?.providerName,
    )
    const providerBySlug = new Map(
        providers.flatMap((provider) => provider.parameters.slug
            ? [[canonicalSlug(provider.parameters.slug), provider] as const]
            : []),
    )

    return {
        ...definition,
        providerOptions: definition.providerOptions.flatMap((option) => {
            const slug = canonicalSlug(option.value)
            if (!available.has(slug) && slug !== currentSlug) return []
            const providerId = providerBySlug.get(slug)?.id
                ?? (slug === currentSlug ? automation?.providerId ?? undefined : undefined)
            return providerId == null ? [] : [{ ...option, providerId }]
        }),
    }
}

function slotOrder(slot: AutomationSlot): number {
    return slot.automation?.executionOrder ?? slot.definition.order
}

/**
 * La definición de presentación que le corresponde a un slot del backend.
 *
 * Se busca por slug del provider, salvo SIRE, que publica DOS slots con el mismo
 * provider (check-in y check-out) y solo se distinguen por el nombre — el mismo
 * criterio que ya usa `definitionForAutomation` para las filas existentes.
 */
function presentationFor(providerSlug: string, slot: ProviderSetupSlot): AutomationDefinition | null {
    const slug = canonicalSlug(providerSlug)
    const id =
        slug === "sire_colombia"
            ? (/out|salida/i.test(slot.name) ? "sire-colombia-checkout" : "sire-colombia-checkin")
            : slug === "tra_colombia" ? "tra-colombia"
            : slug === "ttlock" ? "smart-lock-codes"
            : slug === "pdf_report" ? "guest-report-pdf"
            : slug === "tufirma" || slug === "hitguest_signature" ? "digital-contract"
            : slug === "didit" || slug === "textract"
                ? (slot.guest_type === "secondary_guest"
                    ? "identity-verification-secondary"
                    : "identity-verification-main")
                : null
    return id ? AUTOMATION_DEFINITIONS.find((definition) => definition.id === id) ?? null : null
}

/**
 * Campos a pedirle al PM para un slot: las claves las manda el backend, la forma
 * de renderizar cada una sale del esquema de presentación.
 *
 * Una clave que el backend pida y el esquema no conozca se agrega como texto en
 * vez de descartarse — descartarla haría que el PM guarde una configuración
 * incompleta sin enterarse, que es justo lo que pasaba con `client_id` y
 * `client_secret` de TTLock.
 */
function fieldsForSlot(
    slot: ProviderSetupSlot,
    schema: ParameterFieldSchema[],
): ParameterFieldSchema[] {
    const keys = Object.keys(slot.parameters ?? {})
    if (keys.length === 0) return []
    const byKey = new Map(schema.map((field) => [field.key, field]))
    return keys.map((key) => byKey.get(key) ?? {
        key,
        label: key,
        type: "text" as const,
        required: true,
    })
}

/** Título legible para un slot sin definición de presentación conocida. */
function fallbackDefinition(provider: Provider, slot: ProviderSetupSlot): AutomationDefinition {
    const base = AUTOMATION_DEFINITIONS[0]
    return {
        ...base,
        id: `slot-${provider.parameters.slug}-${slot.order}`,
        order: slot.order,
        title: slot.name || provider.name,
        description: provider.description || "Automatización disponible para el país de esta propiedad.",
        icon: base.icon,
        color: "text-slate-500",
        bgColor: "bg-slate-50",
        guestType: slot.guest_type === "main_guest" ? "main" : slot.guest_type === "secondary_guest" ? "secondary" : "all",
        requiresConfig: Object.keys(slot.parameters ?? {}).length > 0,
        isMandatory: false,
        providerOptions: [{
            value: provider.parameters.slug,
            label: provider.name,
            description: provider.description ?? "",
            parametersSchema: fieldsForSlot(slot, []),
            providerId: provider.id,
        }],
        listingOverrideSchema: undefined,
    }
}

/**
 * Cruza las filas existentes con los slots que el backend declara para el país.
 *
 * Reglas, en orden de importancia:
 *
 * 1. **Ninguna fila del backend se oculta jamás.** Una automatización creada —
 *    aunque no tengamos definición para ella— se renderiza igual, con la tarjeta
 *    genérica de `definitionForAutomation`.
 * 2. Un slot sin fila se ofrece como tarjeta configurable, con el orden, el
 *    nombre y los campos que declara el backend. Los slots de un
 *    `default_setup` con `enabled: false` (hoy tufirma y stripe) no se ofrecen.
 * 3. Sin providers no se agrega nada: lista vacía significa "no sabemos" (el
 *    fetch falló, o el país no tiene seeds), no "no hay nada disponible".
 *
 * El orden respeta el `executionOrder` de la fila real donde existe, y el
 * `order` del slot donde no.
 */
export function buildAutomationSlots(
    automations: PropertyAutomation[],
    providers: Provider[],
): AutomationSlot[] {
    const slots: AutomationSlot[] = []
    const covered = new Set<string>()

    for (const automation of automations) {
        const definition = definitionForAutomation(automation)
        covered.add(definition.id)
        slots.push({ key: automation.uuid, definition, automation })
    }

    for (const provider of providers) {
        // La presencia de `parameters.slug` es lo ÚNICO que separa una automation
        // de un conector que nunca corre. La tabla `providers` mezcla las dos
        // cosas: Colasistencia, Taxxa, Webpos Panamá y Kunas PMS viven ahí sin
        // `slug` ni `job_class` — el despachador las saltaría en su último gate.
        // Y desde que el filtro por país dejó de excluir a los providers sin país
        // declarado, tampoco quedan fuera por accidente. Listarlas dejaría al PM
        // "configurando" algo que no se ejecuta nunca.
        if (!provider.parameters?.slug) continue
        const setup = provider.parameters.default_setup
        if (!setup?.enabled) continue
        for (const slot of setup.slots ?? []) {
            const presentation = presentationFor(provider.parameters.slug, slot)
            const definition: AutomationDefinition = presentation
                ? {
                    ...presentation,
                    // El backend manda el orden; el nuestro era inventado.
                    order: slot.order,
                    providerOptions: presentation.providerOptions.map((option) => ({
                        ...option,
                        parametersSchema: fieldsForSlot(slot, option.parametersSchema),
                    })),
                }
                : fallbackDefinition(provider, slot)

            if (covered.has(definition.id)) continue
            covered.add(definition.id)
            slots.push({
                key: `slot:${provider.parameters.slug}:${slot.order}`,
                definition,
                automation: null,
            })
        }
    }

    return slots.sort(
        (a, b) => slotOrder(a) - slotOrder(b) || a.definition.order - b.definition.order,
    )
}
