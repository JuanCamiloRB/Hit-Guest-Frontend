/**
 * Textos de contrato de una UNIDAD (contrato 2026-10-20). Lógica pura: qué
 * filas ofrecer y qué texto firma cada una.
 *
 * Reglas del backend:
 *  - El texto de la unidad reemplaza al de la propiedad SOLO en esa unidad, y
 *    solo con su override de contrato activo.
 *  - Sigue el modo de los TEXTOS de la propiedad: si la propiedad tiene texto
 *    general, la unidad solo puede reemplazar ese; si tiene textos por canal,
 *    reemplaza el de cada canal que elija y hereda el resto.
 *  - Los textos que dejaron de aplicar porque la propiedad cambió de modo
 *    (`replacedTexts`) no son filas: se muestran aparte para borrarlos.
 */

import type { PropertyDocument } from "../types/document"
import { documentChannelId, documentListingUuid } from "../types/document"
import type { ContractRoutingChannelView } from "../types/contract-routing"
import { ALL_SOURCES_KEY, requiresAgreementDocument } from "../types/contract-routing"
import type { ReservationSource } from "../services/reservation-source-service"
import { detectTextMode, type ContractTextMode } from "./contract-routing-sync"

export interface UnitTextRow {
    /** `"all"` o el id del canal como string. */
    key: string
    /** `null` = texto para todos los canales. */
    channelId: number | null
    name: string
    slug: string | null
    /** El texto de la propiedad que la unidad hereda en esta fila, si existe. */
    propertyDocument: PropertyDocument | null
    /** El texto propio de la unidad que aplica en esta fila, si existe. */
    unitDocument: PropertyDocument | null
}

export interface UnitTextPlan {
    /** `null` = la propiedad no tiene texto de contrato: la unidad no puede reemplazar nada. */
    textMode: ContractTextMode | null
    rows: UnitTextRow[]
}

interface Input {
    propertyDocuments: PropertyDocument[]
    unitDocuments: PropertyDocument[]
    /** Uuids de `contractRouting.replacedTexts`: no aplican, no son filas. */
    replacedUuids: ReadonlySet<string>
    /** Canales de la firma efectiva de la unidad (su override, o la propiedad). */
    routingChannels: ContractRoutingChannelView[]
    sources: ReservationSource[]
}

function sourceName(source: ReservationSource): string {
    const translated = source.name_translations?.es
    return typeof translated === "string" && translated.trim() ? translated : source.name
}

export function planUnitTexts({ propertyDocuments, unitDocuments, replacedUuids, routingChannels, sources }: Input): UnitTextPlan {
    const textMode = detectTextMode(propertyDocuments)
    if (textMode === null) return { textMode, rows: [] }

    const applying = unitDocuments.filter((doc) => !replacedUuids.has(doc.uuid))

    if (textMode === "shared") {
        return {
            textMode,
            rows: [{
                key: ALL_SOURCES_KEY,
                channelId: null,
                name: "Todos los canales",
                slug: null,
                propertyDocument: propertyDocuments.find((doc) => documentChannelId(doc) == null) ?? null,
                unitDocument: applying.find((doc) => documentChannelId(doc) == null) ?? null,
            }],
        }
    }

    // Por canal: los que tienen texto en la propiedad, los que la unidad ya
    // personalizó y los que su firma necesita con contrato de alquiler.
    const ids = new Set<number>()
    for (const doc of [...propertyDocuments, ...applying]) {
        const id = documentChannelId(doc)
        if (id != null) ids.add(id)
    }
    for (const channel of routingChannels) {
        if (channel.channel.id != null && channel.contractType && requiresAgreementDocument(channel.contractType)) {
            ids.add(channel.channel.id)
        }
    }

    const order = new Map(sources.map((source, index) => [source.id, index]))
    const rows = Array.from(ids)
        .sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) || a - b)
        .map((id): UnitTextRow => {
            const source = sources.find((item) => item.id === id)
            const routing = routingChannels.find((channel) => channel.channel.id === id)
            const propertyDocument = propertyDocuments.find((doc) => documentChannelId(doc) === id) ?? null
            const unitDocument = applying.find((doc) => documentChannelId(doc) === id) ?? null
            const docSource = (unitDocument ?? propertyDocument)?.source
            return {
                key: String(id),
                channelId: id,
                name: source ? sourceName(source) : routing?.channel.name || docSource?.name || `Canal ${id}`,
                slug: source?.slug || routing?.channel.slug || docSource?.slug || null,
                propertyDocument,
                unitDocument,
            }
        })
    return { textMode, rows }
}

export interface RowSigning {
    /** Lo que se le dice al PM sobre esta fila. */
    headline: string
    /** El texto que se firma, solo si es UNO y está cargado (para «Ver texto»). */
    document: PropertyDocument | null
    /** Canales de la firma que caen en esta fila, para sus `summary` y avisos. */
    channels: ContractRoutingChannelView[]
}

/**
 * Qué texto FIRMA de verdad la unidad en esta fila.
 *
 * Con `contractRouting` manda el backend: `channels[].document` es la única
 * fuente. `document: null` significa que ese canal no firma texto (solo
 * garantía) o que le falta (`missing_document`) — nunca se rellena con un
 * texto deducido. Solo un backend anterior, que no manda `contractRouting`,
 * cae en la deducción por textos, y entonces no se afirma que «firma» nada.
 */
export function describeRowSigning(
    row: UnitTextRow,
    routing: { channels: ContractRoutingChannelView[] } | null,
    documents: PropertyDocument[],
    listingUuid: string,
): RowSigning {
    const ownedByUnit = (doc: PropertyDocument) => documentListingUuid(doc) === listingUuid

    if (routing === null) {
        const document = row.unitDocument ?? row.propertyDocument
        return {
            headline: !document
                ? "Sin texto de contrato"
                : ownedByUnit(document) ? "Usa el texto propio de esta unidad" : "Usa el texto de la propiedad",
            document,
            channels: [],
        }
    }

    // La fila general cubre todos los canales de la firma; una de canal, solo el suyo.
    const channels = row.channelId == null
        ? routing.channels
        : routing.channels.filter((channel) => channel.channel.id === row.channelId)
    if (channels.length === 0) {
        return { headline: "Este canal no está en la firma de contrato de esta unidad", document: null, channels }
    }

    const signedUuids = Array.from(new Set(channels.flatMap((channel) => channel.document ? [channel.document.uuid] : [])))
    if (signedUuids.length === 0) {
        const notReady = channels.find((channel) => channel.status !== "ready")
        return {
            headline: notReady?.statusLabel
                || (row.channelId == null ? "Ningún canal firma texto de contrato de alquiler" : "En este canal no se firma texto de contrato de alquiler"),
            document: null,
            channels,
        }
    }
    if (signedUuids.length > 1) {
        return { headline: "Los canales firman textos distintos", document: null, channels }
    }
    const document = documents.find((doc) => doc.uuid === signedUuids[0]) ?? null
    if (!document) {
        return { headline: "Firma un texto que no pudimos cargar: vuelve a cargar la pantalla", document: null, channels }
    }
    return {
        headline: ownedByUnit(document) ? "Firma el texto propio de esta unidad" : "Firma el texto de la propiedad",
        document,
        channels,
    }
}
