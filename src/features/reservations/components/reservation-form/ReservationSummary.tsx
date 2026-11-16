import { Send } from "lucide-react"
import { Surface } from "@/components/ui/card"
import { DefinitionItem } from "@/components/ui/definition-list"
import { Figure } from "@/components/ui/figure"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { formatMoney } from "@/lib/money"

export interface SummaryData {
    propertyName: string | null
    listingName: string | null
    channelName: string | null
    from: Date | undefined
    to: Date | undefined
    nights: number
    guests: number
    /** `null` = sin precio escrito. */
    total: number | null
    perNight: number | null
    currency: string
    mode: "create" | "edit"
    sendLinkNow: boolean
}

function shortDate(date: Date): string {
    return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
}

/**
 * El resumen para CONFIRMAR antes de crear o guardar: el alojamiento como dato
 * principal, la estancia y el total. No repite lo que falta (eso va junto a
 * cada campo) y su alto depende del contenido.
 */
export function ReservationSummary({ data, className }: { data: SummaryData; className?: string }) {
    const hasStay = data.listingName != null
    return (
        <Surface as="aside" tone="sunk" flat aria-labelledby="reservation-summary-title" className={className}>
            <div className="space-y-4 p-5">
                <Heading level={3} size="subsection" tone="muted" id="reservation-summary-title">Resumen</Heading>
                {!hasStay ? (
                    <p className="text-sm text-ink-3">Completa la estancia para ver el resumen.</p>
                ) : (
                    <>
                        <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-ink">{data.listingName}</p>
                            {data.propertyName && <p className="truncate text-sm text-ink-2">{data.propertyName}</p>}
                        </div>
                        <dl className="space-y-3">
                            <DefinitionItem label="Fechas">
                                {data.from && data.to
                                    ? `${shortDate(data.from)} → ${shortDate(data.to)} · ${data.nights} ${data.nights === 1 ? "noche" : "noches"}`
                                    : "Sin fechas"}
                            </DefinitionItem>
                            <DefinitionItem label="Huéspedes">{data.guests}</DefinitionItem>
                            <DefinitionItem label="Canal">{data.channelName ?? "Sin canal"}</DefinitionItem>
                        </dl>
                        <div className="border-t border-rule pt-4">
                            <p className="text-xs font-medium text-ink-3">Total</p>
                            {data.total == null ? (
                                <Figure size="lg" tone="absent">—</Figure>
                            ) : data.total === 0 ? (
                                <Figure size="lg">Sin costo</Figure>
                            ) : (
                                <Figure size="lg">{formatMoney(data.total, data.currency)}</Figure>
                            )}
                            {data.perNight != null && (
                                <p className="mt-0.5 text-xs text-ink-2 tabular-nums">{formatMoney(data.perNight, data.currency)} por noche</p>
                            )}
                        </div>
                        {data.mode === "create" && (
                            <p className="flex items-center gap-2 text-xs text-ink-2">
                                <Icon icon={Send} size="sm" className={data.sendLinkNow ? "text-primary" : "text-ink-4"} />
                                {data.sendLinkNow ? "El link se envía al crear" : "El link no se envía al crear"}
                            </p>
                        )}
                    </>
                )}
            </div>
        </Surface>
    )
}
