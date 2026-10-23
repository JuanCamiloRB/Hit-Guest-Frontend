/**
 * 422 `confirmUnitOverrides` (contrato 2026-10-20): un cambio en los textos de
 * contrato de la PROPIEDAD dejaría sin efecto lo que configuró alguna unidad.
 * El backend no aplicó nada y espera que el PM confirme. Para continuar se
 * reenvía la MISMA petición con la confirmación (body o `?confirmUnitOverrides=1`).
 *
 * Se reconoce por la CLAVE `errors.confirmUnitOverrides`, nunca por el texto:
 * los mensajes vienen traducidos según `X-Locale` y pueden cambiar.
 */

import { ApiError } from "@/types/api"

export interface AffectedChannel {
    /** `null` = «Todos los canales». */
    id: number | null
    slug: string | null
    name: string
}

export interface AffectedUnit {
    listingUuid: string
    listingName: string
    /** Textos propios de la unidad que dejan de aplicar (se conservan). */
    replacedTexts: Array<{ uuid: string; channel: AffectedChannel }>
    /** Canales de su firma propia que quedan sin texto: esos huéspedes no firmarían. */
    channelsLeftWithoutText: AffectedChannel[]
}

export interface UnitOverridesConfirmationRequest {
    /** Ya redactados para el PM: el primero es la introducción, luego uno por unidad y efecto. */
    messages: string[]
    affectedUnits: AffectedUnit[]
}

const FIELD = "confirmUnitOverrides"

function strings(value: unknown): string[] {
    if (typeof value === "string") return value.trim() ? [value] : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : []
}

/** `errors` llega como objeto `{campo: [...]}` o como lista de objetos así. */
function confirmationMessages(errors: ApiError["errors"]): string[] | null {
    if (!errors) return null
    const records = Array.isArray(errors) ? errors : [errors]
    let found = false
    const messages: string[] = []
    for (const record of records) {
        if (record && typeof record === "object" && FIELD in record) {
            found = true
            messages.push(...strings((record as Record<string, unknown>)[FIELD]))
        }
    }
    return found ? messages : null
}

function readChannel(raw: unknown): AffectedChannel | null {
    if (typeof raw !== "object" || raw === null) return null
    const channel = raw as Record<string, unknown>
    return {
        id: typeof channel.id === "number" ? channel.id : null,
        slug: typeof channel.slug === "string" ? channel.slug : null,
        name: typeof channel.name === "string" && channel.name ? channel.name : channel.id === null ? "Todos los canales" : "Canal",
    }
}

function readUnit(raw: unknown): AffectedUnit | null {
    if (typeof raw !== "object" || raw === null) return null
    const unit = raw as Record<string, unknown>
    if (typeof unit.listingUuid !== "string") return null
    const replacedTexts = (Array.isArray(unit.replacedTexts) ? unit.replacedTexts : []).flatMap((item: unknown) => {
        if (typeof item !== "object" || item === null) return []
        const text = item as Record<string, unknown>
        const channel = readChannel(text.channel)
        return typeof text.uuid === "string" && channel ? [{ uuid: text.uuid, channel }] : []
    })
    const channelsLeftWithoutText = (Array.isArray(unit.channelsLeftWithoutText) ? unit.channelsLeftWithoutText : [])
        .map(readChannel)
        .filter((channel): channel is AffectedChannel => channel !== null)
    return {
        listingUuid: unit.listingUuid,
        listingName: typeof unit.listingName === "string" && unit.listingName ? unit.listingName : "Unidad",
        replacedTexts,
        channelsLeftWithoutText,
    }
}

/** `null` si el error NO es el pedido de confirmación (cualquier otro 422 sigue su camino). */
export function readUnitOverridesConfirmation(error: unknown): UnitOverridesConfirmationRequest | null {
    if (!(error instanceof ApiError) || error.status !== 422) return null
    const messages = confirmationMessages(error.errors)
    if (messages === null) return null
    const meta = typeof error.meta === "object" && error.meta !== null ? error.meta as Record<string, unknown> : {}
    const affectedUnits = (Array.isArray(meta.affectedUnits) ? meta.affectedUnits : [])
        .map(readUnit)
        .filter((unit): unit is AffectedUnit => unit !== null)
    return { messages, affectedUnits }
}

/** El PM eligió «Cancelar» en el diálogo: el backend no guardó esa petición. */
export class UnitOverridesConfirmationDeclined extends Error {
    constructor() {
        super("El PM no confirmó el cambio sobre las unidades.")
        this.name = "UnitOverridesConfirmationDeclined"
    }
}

/**
 * Ejecuta una escritura de textos de la propiedad. Si el backend pide
 * confirmación, pregunta al PM y, si confirma, reenvía ESA MISMA petición con
 * la confirmación. La confirmación vale solo para esa petición: si otra del
 * mismo guardado vuelve a pedirla, se vuelve a preguntar (puede afectar a
 * otras unidades).
 */
export async function withUnitOverridesConfirmation<T>(
    write: (confirmUnitOverrides: boolean) => Promise<T>,
    ask: (request: UnitOverridesConfirmationRequest) => Promise<boolean>,
): Promise<T> {
    try {
        return await write(false)
    } catch (error) {
        const request = readUnitOverridesConfirmation(error)
        if (!request) throw error
        if (!(await ask(request))) throw new UnitOverridesConfirmationDeclined()
        return write(true)
    }
}
