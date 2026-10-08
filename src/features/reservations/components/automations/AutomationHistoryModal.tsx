"use client"

import { useEffect, useState } from "react"
import { Loader2, FileText } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { StatusPill, type StatusTone } from "@/components/ui/status-pill"
import { API_BASE } from "@/lib/config"
import { automationService } from "@/features/properties/services/automation-service"
import type {
    AutomationUsageRecord,
    UsageRecordStatus,
} from "@/features/properties/types/automation"
import { formatRunDate, errorMessage, TRIGGERED_BY_LABELS } from "./automation-status-meta"
import { CHANNEL_LABEL } from "@/features/properties/lib/checkin-link-delivery"

interface AutomationHistoryModalProps {
    reservationUuid: string
    /** Automation to filter records by (null closes the modal). */
    automation: { uuid: string; name: string } | null
    onClose: () => void
}

/**
 * El estado se pinta con `StatusPill`, no con verdes y rojos propios: es la
 * misma escala que usa la tarjeta desde la que se abre este modal, y con dos
 * paletas distintas el mismo "OK" se leía como dos cosas. De paso, los tonos
 * son tokens, así que el modal sigue el tema claro/oscuro en vez de quedar con
 * texto slate ilegible sobre fondo oscuro.
 */
const RECORD_STATUS_META: Record<UsageRecordStatus, { label: string; tone: StatusTone }> = {
    completed: { label: "OK", tone: "success" },
    failed: { label: "Fallido", tone: "danger" },
    pending: { label: "Procesando", tone: "warning" },
}

/** Lo que respondió (o no) la carga de UNA automatización concreta. */
interface HistoryResult {
    forUuid: string
    records: AutomationUsageRecord[]
    error: string | null
}

export function AutomationHistoryModal({ reservationUuid, automation, onClose }: AutomationHistoryModalProps) {
    // Un solo estado, con el uuid al que pertenece. `isLoading` y `error` se
    // DERIVAN de compararlo con la automatización abierta — mismo patrón de
    // request-key que ContractRoutingSection — así el efecto no necesita ningún
    // setState síncrono para "resetear" (la regla `set-state-in-effect` del repo).
    const [result, setResult] = useState<HistoryResult | null>(null)

    const isOpen = automation !== null
    const current = automation && result?.forUuid === automation.uuid ? result : null
    const isLoading = isOpen && current === null
    const records = current?.records ?? []
    const error = current?.error ?? null

    useEffect(() => {
        if (!automation) return
        let mounted = true
        const { uuid } = automation
        automationService
            .listUsageRecords(reservationUuid, uuid)
            .then(all => {
                if (!mounted) return
                // Backend filters by automationUuid; keep a client guard, and cap at
                // the 10 most recent (records arrive newest-first) per the API spec.
                const forAutomation = all.filter(r => r.automationUuid === uuid)
                setResult({ forUuid: uuid, records: forAutomation.slice(0, 10), error: null })
            })
            .catch((e: unknown) => {
                if (!mounted) return
                const message = e instanceof Error && e.message ? e.message : "No se pudo cargar el historial"
                setResult({ forUuid: uuid, records: [], error: message })
            })
        return () => { mounted = false }
    }, [automation, reservationUuid])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            {/* `sm:max-w-2xl` lleva la variante a propósito: `DialogContent` ya trae
                `sm:max-w-lg`, y una `max-w-2xl` sin variante nunca le gana en ≥640px
                — el diálogo se quedaba en 512px y la tabla se desbordaba. */}
            <DialogContent className="w-[95vw] sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Historial de ejecuciones</DialogTitle>
                    <DialogDescription>{automation?.name}</DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-ink-3">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="text-sm">Cargando historial...</span>
                    </div>
                ) : error ? (
                    <p className="py-8 text-center text-sm text-danger">{error}</p>
                ) : records.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-3">
                        Aún no hay ejecuciones registradas para esta automatización.
                    </p>
                ) : (
                    /* Una lista, no una tabla. Con seis columnas —dos de ellas un id
                       crudo y un detalle casi siempre vacío— no había ancho de
                       diálogo que alcanzara: el badge del contrato se partía en tres
                       líneas y aparecía una barra horizontal. Apilado, el contenido
                       nunca excede el ancho, así que el desborde deja de existir en
                       vez de quedar detrás de un scroll. */
                    <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
                        {records.map(rec => (
                            <HistoryRow key={rec.id} record={rec} reservationUuid={reservationUuid} />
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    )
}

function HistoryRow({
    record,
    reservationUuid,
}: {
    record: AutomationUsageRecord
    reservationUuid: string
}) {
    const meta = RECORD_STATUS_META[record.status]
    const detail = record.status === "failed"
        ? (errorMessage(record.lastError) || "Error")
        : describePayload(record.responsePayload)
    const trigger = record.triggeredBy
        ? (TRIGGERED_BY_LABELS[record.triggeredBy] ?? record.triggeredBy)
        : "—"
    // §13.6: WhatsApp y OTA comparten automatización y provider; sin el canal,
    // un cobro de uno y otro se ven idénticos en el historial.
    const origin = record.channel ? `${trigger} · ${CHANNEL_LABEL[record.channel]}` : trigger
    const charge = chargeLabel(record)

    return (
        <li className="rounded-xl border border-rule p-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                <div className="flex items-center gap-2 text-xs text-ink-3">
                    <span>{formatRunDate(record.createdAt)}</span>
                    <span className="font-mono text-ink-4">#{record.id}</span>
                </div>
            </div>

            <p className="mt-2 text-xs text-ink-2">
                {origin} <span className="text-ink-4">·</span> {charge}
            </p>

            {/* El detalle es "—" en casi toda ejecución: como columna dejaba un
                hueco permanente, como línea simplemente no se dibuja. */}
            {detail !== "—" && (
                <p className="mt-1 text-xs break-words text-ink-2">{detail}</p>
            )}

            {record.responsePayload?.pdf_path != null && (
                <a
                    href={`${API_BASE}/checkin/${reservationUuid}/contract/signed`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-sunk px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-success transition-opacity hover:opacity-80"
                >
                    <FileText size={13} /> Ver contrato firmado
                </a>
            )}
        </li>
    )
}

/**
 * Etiqueta de cobro de una ejecución. Un registro OMITIDO nunca se cobra
 * (contrato: todos los `skipped` llegan sin cargo), así que `skipped: true`
 * manda sobre `billable` — sin esto, un `completed + billable + skipped`
 * mostraba «Facturable» y «No se envió» a la vez. Es la misma regla con la
 * que el tablero de consumo lo excluye de la suma.
 *
 * Un provider facturable con tarifa 0 (WhatsApp mientras Finanzas no la fije,
 * contrato 2026-09-19 §9) no puede leerse como «0.0000», que parece un error.
 */
export function chargeLabel(
    record: Pick<AutomationUsageRecord, "billable" | "unitCost" | "responsePayload">,
): string {
    if (record.responsePayload?.skipped === true || !record.billable) return "Sin cargo"
    const unitCost = record.unitCost != null ? Number(record.unitCost) : null
    if (unitCost === 0) return "Facturable · sin costo por ahora"
    return `Facturable${record.unitCost != null ? ` · ${record.unitCost}` : ""}`
}

/**
 * Motivos documentados de una ejecución omitida (`responsePayload.reason` con
 * `skipped: true`). Un solo mapa cerrado: PDF (§ skill) + envío del link por
 * WhatsApp (§8) y por la OTA (§13.6). Ninguno se cobra. Un motivo desconocido
 * cae al texto genérico — nunca se muestra el código crudo.
 */
export const SKIPPED_REASON_COPY: Readonly<Record<string, string>> = {
    no_recipients: "No se envió: no hay destinatarios configurados.",
    no_whatsapp_phone: "No se envió por WhatsApp: la reserva no tiene un teléfono utilizable.",
    whatsapp_not_configured: "No se envió por WhatsApp: el canal todavía no está habilitado en HIT.",
    not_imported_from_pms: "No se publicó en la OTA: la reserva no vino de Kunas ni Calry.",
    pms_integration_unavailable: "No se publicó en la OTA: la integración con el PMS no está activa.",
    kunas_messaging_not_configured: "No se publicó en la OTA: la mensajería de Kunas todavía no está habilitada en HIT.",
    calry_not_configured: "No se publicó en la OTA: la conexión con Calry todavía no está habilitada en HIT.",
    no_ota_thread: "No se publicó en la OTA: la reserva no tiene conversación en la OTA.",
    already_posted: "No se volvió a publicar: el mensaje ya estaba en la OTA.",
}

/**
 * Resumen cerrado para el PM. `responsePayload` es un detalle crudo de soporte:
 * nunca se enumeran claves/valores arbitrarios ni se hace JSON.stringify.
 */
export function describePayload(payload: Record<string, unknown> | null): string {
    if (!payload || typeof payload !== "object") return "—"
    if (payload.skipped === true) {
        const reason = typeof payload.reason === "string" ? payload.reason : ""
        return Object.hasOwn(SKIPPED_REASON_COPY, reason) ? SKIPPED_REASON_COPY[reason] : "La ejecución fue omitida."
    }
    return "—"
}
