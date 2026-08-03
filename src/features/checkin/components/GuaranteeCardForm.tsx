"use client"

import { useEffect, useRef, useState } from "react"
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js"
import { Loader2, ShieldCheck, AlertTriangle, CreditCard } from "lucide-react"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { GuaranteeInfoCard } from "@/features/checkin/components/GuaranteeInfoCard"
import type { GuaranteeStatus, GuaranteeStatusInfo } from "@/features/checkin/types/checkin"

interface GuaranteeCardFormProps {
    reservationUuid: string
    guestUuid: string
    onStatusChange: (status: GuaranteeStatus) => void
    /** Verification token missing/expired (OTP plan 20260731) — the parent screen
     *  owns navigation/basePath, so it handles clearing the token and redirecting. */
    onSessionExpired: () => void
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 60_000

/**
 * Card-on-file for the damage/consumption guarantee (backend plan 20260731).
 * Tokenizes a card via Stripe Elements — never charges it here. Mirrors
 * SignaturePad's shape: a self-contained widget that reports its result
 * upward through one callback, with no card/border styling of its own so it
 * drops into whatever card the parent step already renders it inside.
 *
 * The backend's confirmation is the only source of truth (its Stripe webhook,
 * not `stripe.confirmCardSetup()`'s client-side result) — same "don't trust
 * the client, poll the backend" shape already used for Didit verification
 * elsewhere in this portal (backend plan §1.4).
 */
export function GuaranteeCardForm({ reservationUuid, guestUuid, onStatusChange, onSessionExpired }: GuaranteeCardFormProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const stripeRef = useRef<Stripe | null>(null)
    const cardElementRef = useRef<StripeCardElement | null>(null)
    const clientSecretRef = useRef<string | null>(null)

    // The single source of truth — the last known backend state. Everything
    // else (card form visible vs. polling spinner vs. confirmation) is derived
    // from it, never a second parallel "UI mode" enum that could desync from it.
    const [status, setStatus] = useState<GuaranteeStatus | null>(null)
    const [cardBrand, setCardBrand] = useState<string | null>(null)
    const [cardLast4, setCardLast4] = useState<string | null>(null)
    const [amount, setAmount] = useState<string | null>(null)
    const [currency, setCurrency] = useState<string | null>(null)

    const [cardComplete, setCardComplete] = useState(false)
    const [cardMounted, setCardMounted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // "Antes de continuar" info gate (Ricardo/Didier thread 20260801) — shown
    // once, before the guest's first attempt at this reservation+guest ever
    // reaches Stripe. Not persisted: a "failed" or "pending" status already
    // proves the guest passed this gate in some earlier attempt, so it's only
    // relevant while status is still "not_started".
    const [infoAcknowledged, setInfoAcknowledged] = useState(false)

    const applyStatusInfo = (info: GuaranteeStatusInfo) => {
        setStatus(info.status)
        setCardBrand(info.cardBrand)
        setCardLast4(info.cardLast4)
        if (info.failureReason) setError(info.failureReason)
        onStatusChange(info.status)
    }

    /** Requests a fresh SetupIntent and mounts a card field for it. */
    const mountCardForm = async (active: () => boolean) => {
        try {
            const intent = await checkinService.createGuaranteeSetupIntent(reservationUuid, guestUuid)
            if (!active()) return
            clientSecretRef.current = intent.clientSecret
            setAmount(intent.guaranteeAmount)
            setCurrency(intent.currency)

            const stripe = await loadStripe(intent.publishableKey)
            if (!active() || !stripe || !containerRef.current) return
            stripeRef.current = stripe

            const elements = stripe.elements()
            const card = elements.create("card", {
                style: {
                    base: {
                        fontSize: "15px",
                        color: "#1B2047",
                        "::placeholder": { color: "#A2A8C4" },
                    },
                    invalid: { color: "#C0392B" },
                },
            })
            card.mount(containerRef.current)
            card.on("change", (e) => {
                setCardComplete(e.complete)
                setError(e.error?.message ?? null)
            })
            cardElementRef.current = card
            setCardMounted(true)
        } catch (err: any) {
            if (!active()) return
            if (err?.status === 401) {
                // OTP plan 20260731: verificationToken missing/expired — parent screen
                // clears it and redirects back to the OTP step.
                onSessionExpired()
                return
            }
            console.error("[GuaranteeCardForm] setup error:", err)
            setError("No pudimos preparar el formulario de tarjeta. Intenta de nuevo.")
        }
    }

    /** Polls until the backend's webhook confirms the card, or times out. */
    const pollUntilResolved = async (active: () => boolean) => {
        const start = Date.now()
        while (active() && Date.now() - start < POLL_TIMEOUT_MS) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
            if (!active()) return
            try {
                const res = await checkinService.getGuaranteeStatus(reservationUuid, guestUuid)
                if (res.guarantee.status === "active" || res.guarantee.status === "failed") {
                    applyStatusInfo(res.guarantee)
                    return
                }
            } catch {
                // Transient network hiccup — keep polling until the timeout below.
            }
        }
        if (active()) {
            setError("Esto está tardando más de lo normal. Puedes seguir esperando o intentar con otra tarjeta.")
        }
    }

    // Resolve the real state on mount (and never assume "not_started" — backend
    // plan §1.5: this status is never included in the main portal response and
    // never persisted client-side, so a reload must always re-ask the backend).
    useEffect(() => {
        let alive = true
        const active = () => alive

        checkinService.getGuaranteeStatus(reservationUuid, guestUuid)
            .then(async (res) => {
                if (!active()) return
                applyStatusInfo(res.guarantee)
                if (res.guarantee.status === "failed") {
                    // A "failed" status means the guest already passed the info gate in
                    // an earlier attempt — go straight to a fresh SetupIntent, same as
                    // handleRetry does for a failure discovered mid-session.
                    await mountCardForm(active)
                } else if (res.guarantee.status === "pending") {
                    // A previous submission is still awaiting its webhook — resume
                    // watching it instead of showing the form again.
                    await pollUntilResolved(active)
                }
                // "not_started" → render shows the info gate; mountCardForm only runs
                // once the guest clicks through it (handleContinueFromInfo).
                // "active" needs neither the form nor polling — just the confirmation view.
            })
            .catch(() => {
                if (active()) applyStatusInfo({ status: "not_started", cardBrand: null, cardLast4: null, failureReason: null })
            })

        return () => {
            alive = false
            cardElementRef.current?.unmount()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservationUuid, guestUuid])

    const handleSubmit = async () => {
        const stripe = stripeRef.current
        const card = cardElementRef.current
        const clientSecret = clientSecretRef.current
        if (!stripe || !card || !clientSecret) return

        setSubmitting(true)
        setError(null)
        try {
            const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
                payment_method: { card },
            })
            if (stripeError) {
                // Immediate client-side validation failure (e.g. a malformed card) —
                // this never reached Stripe's webhook, so the SetupIntent is still
                // good. Let the guest fix the field and resubmit, no new intent needed.
                setError(stripeError.message ?? "No pudimos procesar la tarjeta.")
                return
            }
            // confirmCardSetup resolving does NOT mean the backend knows yet — only
            // its webhook does. Mark pending and poll until it confirms.
            setStatus("pending")
            onStatusChange("pending")
            let alive = true
            await pollUntilResolved(() => alive)
            alive = false
        } finally {
            setSubmitting(false)
        }
    }

    /** Guest clicked through the "antes de continuar" gate — now safe to start Stripe tokenization. */
    const handleContinueFromInfo = async () => {
        setInfoAcknowledged(true)
        let alive = true
        await mountCardForm(() => alive)
        alive = false
    }

    /** The SetupIntent behind a backend-confirmed failure is terminal — get a fresh one. */
    const handleRetry = async () => {
        setError(null)
        setStatus("not_started")
        onStatusChange("not_started")
        cardElementRef.current?.unmount()
        cardElementRef.current = null
        clientSecretRef.current = null
        setCardMounted(false)
        setCardComplete(false)
        let alive = true
        await mountCardForm(() => alive)
        alive = false
    }

    if (status === null) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <Loader2 size={16} className="animate-spin" />
                Cargando garantía…
            </div>
        )
    }

    if (status === "active") {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                <div>
                    <p className="text-sm font-bold text-emerald-700">Tarjeta de garantía registrada</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                        {cardBrand && cardLast4
                            ? `${cardBrand.toUpperCase()} terminada en ${cardLast4}`
                            : "No se ha realizado ningún cobro."}
                    </p>
                </div>
            </div>
        )
    }

    if (status === "not_started" && !infoAcknowledged) {
        return <GuaranteeInfoCard onContinue={handleContinueFromInfo} />
    }

    return (
        <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">
                Tarjeta de garantía<span className="text-red-400 ml-0.5">*</span>
            </label>

            {amount && currency && (
                <p className="text-xs text-slate-500">
                    Solo autorizamos tu tarjeta — no se realiza ningún cobro ahora. HIT Guest únicamente
                    la cobrará si se aprueba un reclamo por daños o consumos, hasta {currency} {amount}.
                </p>
            )}

            {status === "pending" ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin text-[var(--color-brand-purple)]" />
                    Confirmando tu tarjeta…
                </div>
            ) : (
                <>
                    <div
                        ref={containerRef}
                        className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-3.5 focus-within:border-[var(--color-brand-purple)] focus-within:ring-2 focus-within:ring-[var(--color-brand-purple)]/20 transition-all"
                    />
                    {!cardMounted && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 size={13} className="animate-spin" /> Preparando formulario…
                        </div>
                    )}

                    {status === "failed" && (
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="text-xs font-semibold text-[var(--color-brand-purple)] hover:underline"
                        >
                            Intentar con otra tarjeta
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!cardMounted || !cardComplete || submitting}
                        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--color-brand-purple)] text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        {submitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <CreditCard size={16} />
                        )}
                        Autorizar tarjeta
                    </button>
                </>
            )}

            {error && (
                <p className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
                </p>
            )}
        </div>
    )
}
