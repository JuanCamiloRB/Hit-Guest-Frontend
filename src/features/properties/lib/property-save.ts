import type { PropertyFormData } from "../types"
import type { ListingAutomationOverride } from "../types/automation"
import { toListingPayload, type ListingDraft } from "./listing-payload"
import type { PropertyTab } from "./property-tabs"

/**
 * La secuencia de guardado de una propiedad, SIN React (fase 0 del rediseño,
 * plan `20261116_propiedad-form-ux.md`). Se extrajo tal cual de
 * `PropertyForm.saveProperty` para fijarla con pruebas antes de mover un campo.
 */

/**
 * Contrato 2026-08-23: `externalPmsIds: []` BORRA todas las filas y la clave
 * omitida no toca nada. Solo viaja si el PM editó la sección — mandarla siempre
 * convertía cualquier guardado en un borrado potencial (o en un 422 al reenviar
 * filas sin editar).
 */
export function withExternalIdsGating(values: PropertyFormData, sectionDirty: boolean): PropertyFormData {
    return sectionDirty ? values : { ...values, externalPmsIds: undefined }
}

/** El uuid de la propiedad recién creada, venga en la raíz o en `data`. `null` = no vino. */
export function readCreatedPropertyUuid(response: unknown): string | null {
    if (!response || typeof response !== "object") return null
    const r = response as { uuid?: unknown; data?: { uuid?: unknown } }
    const candidate = r.uuid ?? r.data?.uuid
    return typeof candidate === "string" && candidate.trim() !== "" ? candidate : null
}

export interface CreatePropertyResult {
    propertyUuid: string
    /** Nombres de los alojamientos que no se pudieron crear (se sigue con los demás). */
    failedUnits: string[]
    /** Cuántos borradores había. */
    pendingUnits: number
}

/**
 * Crea la propiedad y, con su uuid, cada alojamiento en borrador por separado
 * (`POST /listings`), EN SECUENCIA: ese endpoint también crea registros
 * relacionados y la API no documenta semántica de lote. Un alojamiento que
 * falla no detiene a los demás: se anota y el pie decide a dónde llevar al PM.
 *
 * Sin identificadores externos no se manda la clave (contrato 2026-08-23:
 * presencia = intención).
 */
export async function createPropertyWithUnits(input: {
    values: PropertyFormData
    submitValues: PropertyFormData
    createProperty: (values: PropertyFormData) => Promise<unknown>
    onPropertyCreated?: () => void
    createListing: (payload: ReturnType<typeof toListingPayload>) => Promise<unknown>
    onListingError?: (error: unknown) => void
}): Promise<CreatePropertyResult> {
    const response = await input.createProperty(input.submitValues)
    input.onPropertyCreated?.()
    const propertyUuid = readCreatedPropertyUuid(response)
    if (!propertyUuid) {
        throw new Error("El backend creó la propiedad sin devolver su UUID.")
    }
    const pendingUnits = (input.values.units ?? []) as ListingDraft[]
    const failedUnits: string[] = []
    for (const [index, unit] of pendingUnits.entries()) {
        try {
            await input.createListing(toListingPayload(propertyUuid, {
                ...unit,
                externalPmsIds: unit.externalPmsIds?.length ? unit.externalPmsIds : undefined,
            }))
        } catch (unitError) {
            input.onListingError?.(unitError)
            failedUnits.push(String(unit.name || `Unidad ${index + 1}`))
        }
    }
    return { propertyUuid, failedUnits, pendingUnits: pendingUnits.length }
}

/** Un alojamiento fallido necesita un destino visible para recuperarlo. */
export function tabAfterCreate(failedUnits: string[]): PropertyTab {
    return failedUnits.length ? "units" : "automations"
}

/** El uuid del alojamiento recién creado, venga en `data` o en la raíz. `null` = no vino. */
export function readCreatedListingUuid(response: unknown): string | null {
    if (!response || typeof response !== "object") return null
    const r = response as { uuid?: unknown; data?: { uuid?: unknown } }
    const candidate = r.data?.uuid ?? r.uuid
    return typeof candidate === "string" && candidate.trim() !== "" ? candidate : null
}

/** Lo que el diálogo lee de la respuesta de `POST /listings` para rehidratar la unidad. */
export type CreatedListingData = Record<string, unknown> & {
    uuid?: string
    price?: number | string
    startPrice?: number | string
    start_price?: number | string
    extra?: Record<string, unknown> & { price?: number | string; startPrice?: number | string; currency?: string }
}

export interface CreateListingResult {
    /** El cuerpo útil de la respuesta (`data` o la raíz). */
    apiData: CreatedListingData
    listingUuid: string
    /** Nombres de los overrides que no se pudieron crear (se sigue con los demás). */
    failedOverrides: string[]
}

/**
 * Un alojamiento NUEVO en una propiedad que YA existe: `POST /listings` y, con
 * su uuid, cada override en borrador por separado y EN SECUENCIA. Un override
 * que falla no detiene a los demás: se anota por nombre y el pie avisa.
 *
 * Invariante (fase 0, 2026-11-16): al CREAR una propiedad no hay overrides en
 * borrador. La pestaña «Automatizaciones» del diálogo y la carga de las
 * automatizaciones de la propiedad existen solo con `propertyUuid`
 * (`PropertiesUnits.tsx`), así que `createPropertyWithUnits` no los crea ni
 * los necesita.
 */
export async function createListingWithOverrideDrafts(input: {
    payload: ReturnType<typeof toListingPayload>
    /** Solo borradores con configuración real (`isMeaningfulOverride`), sin `uuid`. */
    drafts: ListingAutomationOverride[]
    createListing: (payload: ReturnType<typeof toListingPayload>) => Promise<unknown>
    /** Entre el alojamiento y los overrides: invalidar cachés y mostrar la unidad ya guardada. */
    onListingCreated?: (apiData: CreatedListingData, listingUuid: string) => void
    createOverride: (draft: ListingAutomationOverride, listingUuid: string) => Promise<unknown>
}): Promise<CreateListingResult> {
    const created = await input.createListing(input.payload)
    const apiData = ((created as { data?: unknown } | null)?.data ?? created ?? {}) as CreatedListingData
    const listingUuid = readCreatedListingUuid(created)
    if (!listingUuid) {
        throw new Error("El backend creó la unidad sin devolver su UUID.")
    }
    input.onListingCreated?.(apiData, listingUuid)
    const failedOverrides: string[] = []
    for (const draft of input.drafts) {
        try {
            await input.createOverride(draft, listingUuid)
        } catch {
            failedOverrides.push(draft.propertyAutomation?.name ?? draft.propertyAutomationUuid)
        }
    }
    return { apiData, listingUuid, failedOverrides }
}
