/**
 * Qué muestra cada celda de automatización de la tabla de Operaciones: su
 * estado, el contador cuando aplica, los canales del link y el DETALLE que se
 * abre al pasar el mouse, enfocar o tocar (plan 20261119).
 *
 * Todo sale de lo que ya llega, sin peticiones nuevas:
 *   - `items`: `GET /reservations/{uuid}/automation-status`, ya pedido por fila
 *     visible (`useAutomationStatusLoader`). `undefined` = todavía no llegó.
 *   - `delivery`: el envío del link por canal, del `extra` de la lista
 *     (`readCheckinLinkDelivery`; observado en `GET /reservations` 2026-11-19).
 *   - `contract`: `extra.digitalContract` de la lista (observado, no
 *     documentado salvo `requestedAt`: se lee como `unknown`).
 *   - `checkin`: el conteo de check-ins completos de la reserva.
 *
 * Puro y sin efectos: corre en cada render de la tabla, así que no avisa por
 * consola (`buildTrafficLight` sí lo hace, una vez por carga).
 */

import type { AutomationGuestStatus, AutomationStatusItem } from "@/features/properties/types/automation"
import { canonicalSlug } from "@/features/properties/services/automation-service"
import { CONTRACT_TYPE_LABELS } from "@/features/properties/types/contract-routing"
import type { DigitalContractSummary } from "./digital-contract"

export { readDigitalContract, type DigitalContractSummary } from "./digital-contract"
import { isCredentialsRejectedError } from "@/lib/credentials-rejection"
import { automationTitle, errorMessage } from "../components/automations/automation-status-meta"
import {
    mailStatusMeta,
    whatsappStatusMeta,
    type CheckinLinkDeliveryStatus,
} from "./checkin-link-delivery-status"

/** Las columnas, en el orden de la tabla. */
export const CELL_KEYS = ["link", "checkin", "contract", "code", "tra", "sireIn", "sireOut"] as const
export type CellKey = (typeof CELL_KEYS)[number]

/**
 * - `success`: hecho. `pending`: en curso o pide atención. `failed`: falló.
 * - `idle`: está configurada pero todavía no corre (antes se veía como «—»).
 * - `none`: no está configurada para esta reserva, o no aplica.
 */
export type CellState = "success" | "pending" | "failed" | "idle" | "none"

export type LinkChannel = "whatsapp" | "email" | "ota"

export interface DetailLine {
    state: CellState
    text: string
}

export interface AutomationCell {
    state: CellState
    /** «1/2»: huéspedes con el check-in completo, o huéspedes reportados. */
    count?: { done: number; total: number }
    /** Solo Link: por qué canales salió, en orden fijo. */
    channels?: LinkChannel[]
    /** Frase corta para el nombre accesible de la celda. */
    summary: string
    /** El detalle, una línea por hecho. Nunca vacío. */
    lines: DetailLine[]
    /** Aclaración al pie del detalle (proveedor, qué hacer). */
    note?: string
}

export interface CheckinCount {
    /** `null`/`undefined` = el backend no reportó el conteo (no es «cero»). */
    completed: number | null | undefined
    total: number | null | undefined
    /** Flag de la reserva: si está completo, la celda es verde sin importar el conteo. */
    isCheckinCompleted: boolean
}


export interface CellSources {
    items: readonly AutomationStatusItem[] | undefined
    delivery: CheckinLinkDeliveryStatus | undefined
    contract: DigitalContractSummary | null | undefined
    checkin: CheckinCount
}

/** Severidad para ordenar: lo que pide atención primero, lo no configurado al final. */
export const CELL_SEVERITY: Record<CellState, number> = {
    failed: 0,
    pending: 1,
    idle: 2,
    success: 3,
    none: 4,
}

const STATE_WORD: Record<CellState, string> = {
    success: "completado",
    pending: "pendiente",
    failed: "falló",
    idle: "todavía no corre",
    none: "no configurado",
}

export const CELL_LABELS: Record<CellKey, string> = {
    link: "Link",
    checkin: "Check-in",
    contract: "Contrato",
    code: "Acceso",
    tra: "TRA",
    sireIn: "SIRE in",
    sireOut: "SIRE out",
}

// ───────────────────────── fechas ─────────────────────────

const BOGOTA_WALL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const BOGOTA_PARTS = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
})

/**
 * «18 nov, 10:42», SIEMPRE en hora de Bogotá, como el resto del panel
 * (`formatRunDate`, `formatRejectionSince`): en una misma tabla no pueden
 * convivir dos zonas. `lastRunAt` llega como hora de pared de Bogotá sin zona
 * («YYYY-MM-DD HH:mm:ss») y se muestra tal cual, sin pasar por `Date` (que en
 * otra zona caería en un cambio de horario); un ISO con zona (los envíos del
 * link, la firma) se convierte a Bogotá.
 */
export function formatMoment(raw: string | null | undefined): string | null {
    if (typeof raw !== "string" || raw.trim() === "") return null
    const text = raw.trim()
    const wall = BOGOTA_WALL.exec(text)
    if (wall) {
        const month = Number(wall[2])
        if (month < 1 || month > 12) return null
        return `${Number(wall[3])} ${MONTHS[month - 1]}, ${wall[4]}:${wall[5]}`
    }
    const date = new Date(text)
    if (Number.isNaN(date.getTime())) return null
    const parts = Object.fromEntries(BOGOTA_PARTS.formatToParts(date).map((part) => [part.type, part.value]))
    return `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]}, ${parts.hour}:${parts.minute}`
}

const at = (raw: string | null | undefined) => {
    const moment = formatMoment(raw)
    return moment ? ` · ${moment}` : ""
}

// ───────────────────────── clasificación de ítems ─────────────────────────

const SIGNATURE_SLUGS = new Set(["tufirma", "hitguest_signature"])
const IDENTITY_SLUGS = new Set(["didit", "textract"])
const LINK_SLUGS = new Set(["whatsapp_checkin_link"])
const LINK_NAME_RE = /link\s*delivery|env[ií]o\s+del\s+link/i
const IDENTITY_NAME_RE = /identity|verificaci[oó]n/i
const CONTRACT_NAME_RE = /firma|contrato|signature/i
const SIRE_OUT_RE = /out|check-?out|salida/i

type ItemKind = CellKey | "identity" | null

/**
 * A qué columna va un ítem. El envío del link se reconoce ANTES que la
 * identidad: «Check-in Link Delivery» contiene «check-in» y antes caía en la
 * luz de Check-in. `pdf_report` y los desconocidos no tienen columna (`null`).
 */
export function classifyItem(item: Pick<AutomationStatusItem, "providerSlug" | "automationName">): ItemKind {
    const slug = canonicalSlug(item.providerSlug ?? "")
    const name = item.automationName ?? ""
    if (LINK_SLUGS.has(slug) || LINK_NAME_RE.test(name)) return "link"
    if (slug === "sire_colombia") return SIRE_OUT_RE.test(name) ? "sireOut" : "sireIn"
    if (SIGNATURE_SLUGS.has(slug)) return "contract"
    if (slug === "ttlock") return "code"
    if (slug === "tra_colombia") return "tra"
    if (IDENTITY_SLUGS.has(slug) || IDENTITY_NAME_RE.test(name)) return "identity"
    if (CONTRACT_NAME_RE.test(name)) return "contract"
    return null
}

// ───────────────────────── estado de un ítem ─────────────────────────

/**
 * En pausa por credenciales rechazadas: la misma regla que el panel de la
 * reserva (`isPausedRow`): lo completado o lo que no aplica NUNCA se pinta en
 * pausa, aunque arrastre el código.
 */
function isPaused(row: { status: string; lastError: unknown }): boolean {
    return row.status !== "completed" && row.status !== "skipped" && isCredentialsRejectedError(row.lastError)
}

function itemState(item: AutomationStatusItem): CellState {
    if (isPaused(item)) return "pending"
    switch (item.status) {
        case "completed": return "success"
        // Falló después de haber salido bien: degradado, no un fallo de cero.
        case "failed": return item.wasSuccessful ? "pending" : "failed"
        case "pending": return "pending"
        case "not_started": return "idle"
        default: return "idle"
    }
}

/**
 * El error en palabras: los códigos que la app ya traduce (`errorMessage`, el
 * mismo texto que el panel: saldo insuficiente, credenciales, precio…) o una
 * frase del backend. Un código suelto que nadie traduce no le dice nada al PM.
 */
function readableError(lastError: unknown): string | null {
    const raw = typeof lastError === "string"
        ? lastError.trim()
        : lastError && typeof lastError === "object" && typeof (lastError as { message?: unknown }).message === "string"
            ? ((lastError as { message: string }).message).trim()
            : ""
    if (!raw) return null
    if (raw === "identity_not_verified") return "La identidad no se verificó"
    const translated = errorMessage(raw)
    if (translated && translated !== raw) return translated
    return /\s/.test(raw) ? raw : null
}

function itemLine(item: AutomationStatusItem, title?: string): DetailLine {
    const prefix = title ? `${title} · ` : ""
    const state = itemState(item)
    if (isPaused(item)) {
        return { state, text: `${prefix}en pausa: el proveedor rechazó las credenciales` }
    }
    switch (item.status) {
        case "completed":
            return { state, text: `${prefix}completado${at(item.lastSuccessAt ?? item.lastRunAt)}` }
        case "failed": {
            const why = readableError(item.lastError)
            const base = item.wasSuccessful ? "falló después de un envío correcto" : "falló"
            return { state, text: `${prefix}${base}${at(item.lastRunAt)}${why ? `: ${why}` : ""}` }
        }
        case "pending":
            return { state, text: `${prefix}en proceso${at(item.lastRunAt)}` }
        default:
            return { state, text: `${prefix}todavía no corre` }
    }
}

const GUEST_WORD: Record<string, { state: CellState; word: string }> = {
    completed: { state: "success", word: "reportado" },
    failed: { state: "failed", word: "falló" },
    pending: { state: "pending", word: "en proceso" },
    not_started: { state: "idle", word: "todavía no" },
    skipped: { state: "none", word: "no aplica" },
}

function guestLine(guest: AutomationGuestStatus): DetailLine {
    const who = guest.name?.trim() || (guest.isMainGuest ? "Huésped principal" : "Acompañante")
    if (isPaused(guest)) return { state: "pending", text: `${who} · en pausa: el proveedor rechazó las credenciales` }
    const meta = GUEST_WORD[guest.status] ?? { state: "idle" as const, word: String(guest.status) }
    const why = guest.status === "failed" ? readableError(guest.lastError) : null
    return { state: meta.state, text: `${who} · ${meta.word}${why ? `: ${why}` : ""}` }
}

/** El peor estado de una lista (el que más pide atención). */
function worst(states: CellState[]): CellState {
    if (states.length === 0) return "none"
    return states.reduce((a, b) => (CELL_SEVERITY[b] < CELL_SEVERITY[a] ? b : a))
}

/**
 * Varias partes de una misma cosa (huéspedes de un reporte, varias filas de la
 * misma columna): un fallo manda; todo hecho es verde; algo hecho o en curso
 * con el resto sin empezar está EN CURSO (no «todavía no corre», que sería
 * falso con un huésped ya reportado); nada empezado, todavía no corre.
 */
function combine(states: CellState[]): CellState {
    const counted = states.filter((s) => s !== "none")
    if (counted.length === 0) return "none"
    if (counted.includes("failed")) return "failed"
    if (counted.every((s) => s === "success")) return "success"
    if (counted.some((s) => s === "pending" || s === "success")) return "pending"
    return "idle"
}

const NONE = (text: string, summary = STATE_WORD.none): AutomationCell => ({ state: "none", summary, lines: [{ state: "none", text }] })

// ───────────────────────── columnas ─────────────────────────

function perGuestCell(item: AutomationStatusItem): AutomationCell {
    const counted = item.guests.filter((g) => g.status !== "skipped")
    const lines = item.guests.map(guestLine)
    // Configurada, pero a ningún huésped le aplica (p. ej. SIRE con nacionales):
    // no es «no configurado».
    if (counted.length === 0) return { state: "none", summary: "no aplica", lines }
    const done = counted.filter((g) => g.status === "completed").length
    const state = combine(counted.map((g) => (isPaused(g) ? "pending" : GUEST_WORD[g.status]?.state ?? "idle")))
    const paused = counted.some(isPaused) || isPaused(item)
    return {
        state,
        count: { done, total: counted.length },
        summary: `${done} de ${counted.length} huéspedes`,
        lines,
        note: paused ? "Actualiza las credenciales en la propiedad" : undefined,
    }
}

function itemCell(items: AutomationStatusItem[], notConfigured: string): AutomationCell {
    if (items.length === 0) return NONE(notConfigured)
    if (items.length === 1 && items[0].isPerGuest && items[0].guests.length > 0) return perGuestCell(items[0])
    // Varias filas para la misma columna (no se observó, pero si llegan, un
    // fallo de cualquiera no puede quedar oculto detrás de la primera).
    const lines = items.length === 1
        ? [itemLine(items[0])]
        : items.map((item) => itemLine(item, automationTitle(item.providerSlug, item.automationName)))
    const state = items.length === 1 ? lines[0].state : combine(lines.map((l) => l.state))
    return {
        state,
        summary: STATE_WORD[state],
        lines: lines.map((line) => ({ ...line, text: capitalize(line.text) })),
        note: items.some(isPaused) ? "Actualiza las credenciales en la propiedad" : undefined,
    }
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Estados de entrega que el contrato documenta (§6). Lo demás no se afirma. */
const SENT_STATUSES = new Set(["sent", "delivered", "read"])

/**
 * El estado de una línea de canal. «Enviado» sin confirmación (`null`, `sent`)
 * cuenta como hecho: el link salió, que es lo que mide la columna. Un estado
 * que el contrato no documenta NO se pinta verde (fallo cerrado): pide revisión.
 */
function deliveryState(tone: string, status: string | null): CellState {
    if (tone === "danger") return "failed"
    if (tone === "warning") return "pending"
    if (status === null || SENT_STATUSES.has(status)) return "success"
    return "pending"
}

function linkCell(delivery: CheckinLinkDeliveryStatus | undefined, items: AutomationStatusItem[] | undefined): AutomationCell | null {
    const lines: DetailLine[] = []
    const channels: LinkChannel[] = []
    if (delivery?.whatsapp) {
        const meta = whatsappStatusMeta(delivery.whatsapp)
        channels.push("whatsapp")
        lines.push({ state: deliveryState(meta.tone, delivery.whatsapp.status), text: `WhatsApp · ${meta.label.toLowerCase()}${at(delivery.whatsapp.statusAt ?? delivery.whatsapp.sentAt)}${meta.detail ? `: ${meta.detail}` : ""}` })
    }
    if (delivery?.email) {
        const meta = mailStatusMeta(delivery.email)
        channels.push("email")
        lines.push({ state: deliveryState(meta.tone, delivery.email.status), text: `Correo · ${meta.label.toLowerCase()}${at(delivery.email.sentAt)}${meta.detail ? `: ${meta.detail}` : ""}` })
    }
    if (delivery?.ota) {
        channels.push("ota")
        lines.push({ state: "success", text: `Mensaje en la OTA · publicado${at(delivery.ota.sentAt)}` })
    }
    if (lines.length > 0) {
        const states = lines.map((l) => l.state)
        const ok = states.filter((s) => s === "success").length
        const bad = states.filter((s) => s === "failed").length
        // Un canal falló pero otro llegó: el huésped tiene el link, pero hay algo que mirar.
        const state: CellState = bad === 0 ? worst(states) : ok > 0 ? "pending" : "failed"
        return {
            state,
            channels,
            summary: state === "success"
                ? `enviado por ${channels.map((c) => CHANNEL_NAME[c]).join(" y ")}`
                : state === "failed" ? "no se pudo entregar" : "un canal necesita revisión",
            lines,
            note: delivery?.ota ? "La OTA no confirma si el huésped leyó el mensaje" : undefined,
        }
    }
    // Sin envío registrado: lo dice la automatización, si ya llegó su estado.
    if (items === undefined) return null
    const own = items.filter((item) => classifyItem(item) === "link")
    // Sin envío ni automatización de WhatsApp el link igual sale por correo
    // (contrato, tabla de verdad del envío): «no configurado» sería falso.
    if (own.length === 0) {
        return { state: "idle", channels: [], summary: "todavía no se envía", lines: [{ state: "idle", text: "Sin envío registrado todavía" }] }
    }
    const cell = itemCell(own, "")
    return { ...cell, channels: [] }
}

const CHANNEL_NAME: Record<LinkChannel, string> = { whatsapp: "WhatsApp", email: "correo", ota: "la OTA" }

function checkinCell(count: CheckinCount, items: AutomationStatusItem[] | undefined): AutomationCell | null {
    const identity = (items ?? []).filter((item) => classifyItem(item) === "identity")
    const identityLines = identity.map((item) => itemLine(item, automationTitle(item.providerSlug, item.automationName)))
    const total = typeof count.total === "number" && count.total > 0 ? count.total : null
    const completed = typeof count.completed === "number" ? Math.min(Math.max(count.completed, 0), total ?? count.completed) : null

    if (total !== null && (completed !== null || count.isCheckinCompleted)) {
        // Decisión de producto (2026-08-21): la columna cuenta check-ins COMPLETOS.
        // La verificación de identidad va al detalle; no cambia el color.
        const done = count.isCheckinCompleted ? total : completed!
        const state: CellState = done >= total ? "success" : "pending"
        return {
            state,
            count: { done, total },
            summary: `${done} de ${total} ${total === 1 ? "huésped completó" : "huéspedes completaron"} el check-in`,
            lines: [
                { state, text: `${done} de ${total} ${total === 1 ? "huésped completó" : "huéspedes completaron"} su check-in` },
                ...identityLines,
            ],
        }
    }
    if (count.isCheckinCompleted) {
        return { state: "success", summary: "check-in completo", lines: [{ state: "success", text: "Check-in completo" }, ...identityLines] }
    }
    // Sin conteo: el flag de la reserva dice que NO está completo, así que nunca
    // es verde; y la identidad no pone la celda en rojo (decisión 2026-08-21):
    // con algo empezado está en curso, si no, todavía no corre.
    if (items === undefined) return null
    if (identity.length === 0) return NONE("La verificación de identidad no está configurada")
    const started = identity.some((item) => item.status !== "not_started")
    const state: CellState = started ? "pending" : "idle"
    return {
        state,
        summary: started ? "check-in en curso" : STATE_WORD.idle,
        lines: [{ state, text: started ? "Check-in en curso" : "Check-in sin empezar" }, ...identityLines],
    }
}

const PROVIDER_NAME: Record<string, string> = {
    hitguest: "Firma nativa de HitGuest",
    hitguest_signature: "Firma nativa de HitGuest",
    tufirma: "TuFirma",
}

function contractCell(contract: DigitalContractSummary | null | undefined, items: AutomationStatusItem[] | undefined): AutomationCell | null {
    const what = contract?.contractType ? CONTRACT_TYPE_LABELS[contract.contractType] : "Contrato"
    const provider = contract?.provider ? PROVIDER_NAME[canonicalSlug(contract.provider)] ?? PROVIDER_NAME[contract.provider] : undefined
    // Firmado SOLO con el estado observado (`completed`), o con fecha de firma y
    // sin estado. Un estado que no conocemos no se lee como firmado.
    const signed = contract?.status === "completed" || (contract?.status === null && contract.signedAt !== null && !contract.notIssued)
    if (contract && signed) {
        return {
            state: "success",
            summary: "firmado",
            lines: [{ state: "success", text: `${what} · firmado${at(contract.signedAt)}` }],
            note: provider,
        }
    }
    if (contract?.notIssued) {
        return {
            state: "failed",
            summary: "no se emitió",
            lines: [{ state: "failed", text: "El contrato no se emitió" }],
            note: "Revisa el texto del contrato en la propiedad",
        }
    }
    if (items === undefined) return null
    const own = items.filter((item) => classifyItem(item) === "contract")
    const cell = own.length > 0 ? itemCell(own, "") : null
    // Un estado de contrato que no está documentado: no se afirma nada, pide revisión.
    if (contract?.status && contract.status !== "completed") {
        if (cell?.state === "failed") return { ...cell, note: cell.note ?? provider }
        return { state: "pending", summary: "por revisar", lines: [{ state: "pending", text: `${what} · revísalo en la ficha de la reserva` }], note: provider }
    }
    // Enviado a firmar: manda sobre «todavía no corre» o «en proceso», nunca sobre
    // lo que la automatización ya dio por hecho o por fallido; y vale aunque la
    // automatización ya no esté activa.
    if (contract?.requestedAt && (!cell || cell.state === "idle" || cell.state === "pending")) {
        return { state: "pending", summary: "enviado a firmar", lines: [{ state: "pending", text: `${what} · enviado a firmar${at(contract.requestedAt)}` }], note: provider }
    }
    if (!cell) return NONE("El contrato no está configurado")
    return { ...cell, note: cell.note ?? provider }
}

const NOT_CONFIGURED: Record<"code" | "tra" | "sireIn" | "sireOut", string> = {
    code: "El acceso no está configurado",
    tra: "TRA no está configurado",
    sireIn: "SIRE no está configurado",
    sireOut: "SIRE no está configurado",
}

/**
 * Las siete celdas de una reserva. Una celda es `null` mientras su fuente no
 * llegó (la tabla la pinta cargando); el envío del link y el contrato pueden
 * estar listos antes que el estado de automatizaciones.
 */
export function buildAutomationCells(source: CellSources): Record<CellKey, AutomationCell | null> {
    const items = source.items ? [...source.items] : undefined
    const of = (key: CellKey) => (items ?? []).filter((item) => classifyItem(item) === key)
    return {
        link: linkCell(source.delivery, items),
        checkin: checkinCell(source.checkin, items),
        contract: contractCell(source.contract, items),
        code: items === undefined ? null : itemCell(of("code"), NOT_CONFIGURED.code),
        tra: items === undefined ? null : itemCell(of("tra"), NOT_CONFIGURED.tra),
        sireIn: items === undefined ? null : itemCell(of("sireIn"), NOT_CONFIGURED.sireIn),
        sireOut: items === undefined ? null : itemCell(of("sireOut"), NOT_CONFIGURED.sireOut),
    }
}

/** El nombre accesible de una celda: «Contrato: firmado». */
export function cellAccessibleName(key: CellKey, cell: AutomationCell): string {
    return `${CELL_LABELS[key]}: ${cell.summary}`
}
