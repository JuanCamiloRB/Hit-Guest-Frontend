"use client"

import { CreditCard, AlertTriangle } from "lucide-react"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { formatMoney } from "@/lib/money"
import { formatDeclaredAt, type GuestPriceDeclaration } from "../lib/guest-price-declaration"

interface Props {
    totalPrice: number
    /** `null` = la respuesta no trajo moneda: se avisa, nunca se muestra como COP. */
    currency: string | null
    nights: number
    /** Contrato 2026-09-27: el valor vigente lo escribió el huésped principal. */
    priceDeclaredByGuest: boolean
    /** Historial de la declaración; se conserva aunque el PM corrija. */
    guestPriceDeclaration: GuestPriceDeclaration | null
    onCorrect: () => void
}

/**
 * Importe de la reserva. Solo los datos que la API devuelve: sin estado ni
 * método de pago inventados. El valor declarado por un tercero se marca para
 * revisarlo y se ofrece corregirlo; al corregir, el backend baja el flag y el
 * badge se va solo.
 */
export function ReservationPriceCard({
    totalPrice,
    currency,
    nights,
    priceDeclaredByGuest,
    guestPriceDeclaration,
    onCorrect,
}: Props) {
    const declaredAt = formatDeclaredAt(guestPriceDeclaration?.declaredAt ?? null)
    return (
        <SectionCard title="Importe">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-2xl font-bold tracking-tight text-ink">{formatMoney(totalPrice, currency)}</span>
                <span className="shrink-0 text-xs text-ink-3">
                    {nights} {nights === 1 ? "noche" : "noches"}
                </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                <CreditCard size={13} aria-hidden />
                Valor total de la reserva
            </p>
            {!currency && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                    La reserva no informa su moneda.
                </p>
            )}
            {priceDeclaredByGuest && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill tone="warning">Valor declarado por el huésped</StatusPill>
                    <button
                        type="button"
                        onClick={onCorrect}
                        className="text-xs font-semibold text-[var(--color-brand-purple)] underline underline-offset-2 hover:opacity-80"
                    >
                        Corregir valor
                    </button>
                </div>
            )}
            {guestPriceDeclaration && (
                <p className="mt-2 text-xs text-ink-3">
                    El huésped declaró{" "}
                    <span className="font-semibold text-ink-2">
                        {formatMoney(guestPriceDeclaration.amount, guestPriceDeclaration.currency)}
                    </span>
                    {declaredAt ? ` el ${declaredAt}` : ""}.
                </p>
            )}
        </SectionCard>
    )
}
