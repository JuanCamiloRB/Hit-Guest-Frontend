"use client"

import { useEffect, useRef, useState } from "react"
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js"
import { Loader2, ShieldCheck, AlertTriangle, CreditCard } from "lucide-react"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { normalizeApiError } from "@/lib/notify-error"
import { asCheckinError } from "@/features/checkin/lib/checkin-error"
import { GuaranteeInfoCard } from "@/features/checkin/components/GuaranteeInfoCard"
import {
    describeGuaranteeSetupFailure,
    readUsableSetupIntent,
    type GuaranteeSetupFailure,
} from "@/features/checkin/components/guarantee-setup-meta"
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
 * Lo único que se le muestra al huésped cuando algo sale mal.
 *
 * Es una unión discriminada y no dos estados sueltos (`error` + `causa`) por lo
 * mismo que este componente ya evita un "UI mode" paralelo al status: dos
 * fuentes de verdad para la misma pantalla se desincronizan, y acá eso
 * significaría mostrar el texto de una causa junto al botón de otra.
 *
 * - `setup`: falló preparar el formulario. El texto y si se puede reintentar
 *   salen de `guarantee-setup-meta.ts`, no de acá.
 * - `message`: el texto ya viene listo de quien lo produjo (Stripe, el
 *   `failureReason` del backend, o el aviso de sondeo agotado).
 */
type Problem =
    | { kind: "setup"; cause: GuaranteeSetupFailure }
    | { kind: "message"; text: string }

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
 *
 * ## Dos reglas estructurales que este componente tuvo que aprender a la mala
 *
 * **1. El montaje del campo de tarjeta lo dispara un efecto, nunca una llamada
 * imperativa.** Antes se llamaba a `mountCardForm()` a mano desde tres sitios
 * (el efecto inicial, el botón de la puerta de información y el reintento), y
 * los tres leían `containerRef.current` sin garantía de que React ya hubiera
 * montado ese nodo: funcionaba solo porque el `await` del fetch alcanzaba a
 * darle tiempo al render. React asigna los refs en la fase de commit, **antes**
 * de correr los efectos, así que hacerlo desde un efecto convierte esa carrera
 * en una garantía — y de paso deja un único punto de montaje en vez de tres.
 *
 * **2. El contenedor del campo no puede estar bajo renderizado condicional.**
 * Vivía dentro de la rama `status !== "pending"`, así que al enviar la tarjeta
 * (`setStatus("pending")`) React destruía el nodo y con él el iframe de Stripe,
 * mientras `cardElementRef` seguía apuntando a un element huérfano y
 * `cardMounted` seguía en `true`. Si el sondeo terminaba en `failed`, el huésped
 * veía un recuadro vacío sin explicación. Ahora el nodo se mantiene montado y
 * solo se oculta.
 */
export function GuaranteeCardForm({ reservationUuid, guestUuid, onStatusChange, onSessionExpired }: GuaranteeCardFormProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const stripeRef = useRef<Stripe | null>(null)
    const cardElementRef = useRef<StripeCardElement | null>(null)
    const clientSecretRef = useRef<string | null>(null)
    // Vivo mientras el componente esté montado. Los handlers usaban un `let
    // alive = true` local que se ponía en false DESPUÉS del await, así que
    // durante la espera valía siempre true: si el huésped salía de la pantalla
    // a mitad del sondeo, este seguía pegándole al backend hasta el timeout.
    const mountedRef = useRef(true)

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
    const [problem, setProblem] = useState<Problem | null>(null)
    // El sondeo se agotó sin respuesta del webhook. Solo habilita el botón de
    // volver a comprobar: no cambia el estado, que sigue siendo el del backend.
    const [pollTimedOut, setPollTimedOut] = useState(false)
    // "Antes de continuar" info gate (Ricardo/Didier thread 20260801) — shown
    // once, before the guest's first attempt at this reservation+guest ever
    // reaches Stripe. Not persisted: a "failed" or "pending" status already
    // proves the guest passed this gate in some earlier attempt, so it's only
    // relevant while status is still "not_started".
    const [infoAcknowledged, setInfoAcknowledged] = useState(false)
    /**
     * Fuerza un montaje nuevo cuando el estado que lo dispara no cambió.
     *
     * Sin esto, «intentar con otra tarjeta» desde `failed` no remontaría nada:
     * `needsCardForm` ya era `true` antes y sigue siéndolo después, así que el
     * efecto no volvería a correr. Mismo recurso que el token de generación que
     * ya usa el sondeo de verificación de identidad contra el sondeo zombi.
     */
    const [mountGeneration, setMountGeneration] = useState(0)

    const applyStatusInfo = (info: GuaranteeStatusInfo) => {
        // El backend ya respondió algo distinto de "esperando": el aviso de
        // sondeo agotado deja de aplicar.
        if (info.status !== "pending") setPollTimedOut(false)
        setStatus(info.status)
        setCardBrand(info.cardBrand)
        setCardLast4(info.cardLast4)
        if (info.failureReason) setProblem({ kind: "message", text: info.failureReason })
        onStatusChange(info.status)
    }

    /**
     * Pide un SetupIntent nuevo y monta el campo de tarjeta contra él.
     *
     * Cada fase falla por su cuenta y con su propia causa. Antes había un solo
     * `try/catch` alrededor de todo, así que un 200 sin `publishableKey`, un
     * contenedor sin montar y una excepción de Elements terminaban en el mismo
     * texto — y ninguno se podía distinguir desde la pantalla.
     */
    const mountCardForm = async () => {
        const alive = () => mountedRef.current

        let intent
        try {
            intent = await checkinService.createGuaranteeSetupIntent(reservationUuid, guestUuid)
        } catch (raw: unknown) {
            if (!alive()) return
            const err = asCheckinError(raw)
            if (err.status === 401) {
                // OTP plan 20260731: verificationToken missing/expired — parent screen
                // clears it and redirects back to the OTP step.
                onSessionExpired()
                return
            }
            console.error("[GuaranteeCardForm] el setup-intent falló:", err)
            setProblem({ kind: "setup", cause: "backend_error" })
            return
        }
        if (!alive()) return

        // Informativos: se muestran aunque después falle el montaje, y su
        // ausencia nunca bloquea la tokenización.
        setAmount(intent.guaranteeAmount == null ? null : String(intent.guaranteeAmount))
        setCurrency(intent.currency)

        // Un 200 cuyo payload no permite continuar NO es un éxito. Sin este
        // corte, la respuesta seguía derecho hasta `loadStripe`, que reventaba
        // con un error irreconocible tres líneas más abajo.
        const usable = readUsableSetupIntent(intent)
        if (!usable.ok) {
            console.error(
                "[GuaranteeCardForm] el 200 del setup-intent no trae los campos para montar Stripe",
                {
                    tieneClientSecret: typeof intent.clientSecret === "string" && intent.clientSecret !== "",
                    tienePublishableKey: typeof intent.publishableKey === "string" && intent.publishableKey !== "",
                },
            )
            setProblem({ kind: "setup", cause: usable.cause })
            return
        }
        clientSecretRef.current = usable.intent.clientSecret

        let stripe: Stripe | null
        try {
            stripe = await loadStripe(usable.intent.publishableKey)
        } catch (err) {
            if (!alive()) return
            // Stripe.js rechaza la promesa cuando la llave no le sirve. Es un
            // problema de configuración de la cuenta, no algo que el huésped
            // pueda resolver reintentando.
            console.error("[GuaranteeCardForm] Stripe.js rechazó la publishableKey:", err)
            setProblem({ kind: "setup", cause: "stripe_rejected" })
            return
        }
        if (!alive()) return

        if (!stripe) {
            // `loadStripe` resuelve null cuando js.stripe.com no llegó a
            // cargar: bloqueador de anuncios, red corporativa o CSP.
            console.error("[GuaranteeCardForm] loadStripe() devolvió null — Stripe.js no cargó")
            setProblem({ kind: "setup", cause: "stripe_blocked" })
            return
        }
        if (!containerRef.current) {
            // Con el montaje disparado desde un efecto esto ya no debería poder
            // pasar (los refs se asignan antes de los efectos). Se mantiene como
            // red de seguridad: si vuelve a ocurrir, ahora se sabe cuál fue.
            console.error("[GuaranteeCardForm] el contenedor del campo de tarjeta no llegó a montarse")
            setProblem({ kind: "setup", cause: "container_missing" })
            return
        }
        stripeRef.current = stripe

        try {
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
                setProblem(e.error?.message ? { kind: "message", text: e.error.message } : null)
            })
            cardElementRef.current = card
            setCardMounted(true)
        } catch (err) {
            console.error("[GuaranteeCardForm] Stripe Elements no se pudo montar:", err)
            setProblem({ kind: "setup", cause: "elements_failed" })
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
            setProblem({
                kind: "message",
                text: "Esto está tardando más de lo normal. Vuelve a comprobar en unos segundos o intenta con otra tarjeta.",
            })
            setPollTimedOut(true)
        }
    }

    /**
     * Vuelve a preguntar por el estado tras agotarse el sondeo.
     *
     * El webhook de Stripe puede tardar más que la ventana de 60 s. Cuando eso
     * pasaba, el estado quedaba en "pending" para siempre: el paso del contrato
     * exige la garantía en "active" para habilitar el botón de finalizar, y esta
     * pantalla no ofrecía ni reintento (solo aparece en "failed") ni forma de
     * volver a consultar. El check-in quedaba trabado y la única salida era
     * recargar la página.
     */
    const handleRecheck = async () => {
        setProblem(null)
        setPollTimedOut(false)
        try {
            const res = await checkinService.getGuaranteeStatus(reservationUuid, guestUuid)
            applyStatusInfo(res.guarantee)
            if (res.guarantee.status === "pending") await pollUntilResolved(() => mountedRef.current)
        } catch (err) {
            if (normalizeApiError(err).status === 401) {
                onSessionExpired()
                return
            }
            setProblem({ kind: "message", text: "No pudimos consultar el estado de tu tarjeta. Intenta de nuevo." })
            setPollTimedOut(true)
        }
    }

    // Resolve the real state on mount (and never assume "not_started" — backend
    // plan §1.5: this status is never included in the main portal response and
    // never persisted client-side, so a reload must always re-ask the backend).
    useEffect(() => {
        mountedRef.current = true
        const active = () => mountedRef.current

        checkinService.getGuaranteeStatus(reservationUuid, guestUuid)
            .then(async (res) => {
                if (!active()) return
                applyStatusInfo(res.guarantee)
                if (res.guarantee.status === "pending") {
                    // A previous submission is still awaiting its webhook — resume
                    // watching it instead of showing the form again.
                    await pollUntilResolved(active)
                }
                // "failed" y "detached" ya no montan el formulario desde acá: al
                // pasar `needsCardForm` a true, el efecto de montaje se encarga
                // —y lo hace con el contenedor ya en el DOM—. "detached" es la
                // tarjeta desvinculada fuera del portal: para el huésped equivale
                // a no tener ninguna, así que necesita el mismo formulario nuevo.
                // "not_started" muestra la puerta de información primero.
                // "active" no necesita ni formulario ni sondeo.
            })
            .catch((err: unknown) => {
                if (!active()) return
                if (normalizeApiError(err).status === 401) {
                    // Mismo 401 que maneja mountCardForm: el verificationToken
                    // venció. Degradarlo a "not_started" mostraba la puerta de
                    // información y recién rebotaba al huésped DESPUÉS de que
                    // aceptara — un paso muerto sobre un token ya vencido.
                    onSessionExpired()
                    return
                }
                applyStatusInfo({ status: "not_started", cardBrand: null, cardLast4: null, failureReason: null })
            })

        return () => {
            mountedRef.current = false
            cardElementRef.current?.unmount()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservationUuid, guestUuid])

    /**
     * Estados del backend en los que el huésped tiene que cargar una tarjeta.
     *
     * `not_started` solo cuenta después de la puerta de información: es el único
     * momento del flujo en el que el huésped todavía no vio para qué se le pide
     * la tarjeta.
     */
    const needsCardForm =
        status === "failed"
        || status === "detached"
        || (status === "not_started" && infoAcknowledged)

    /**
     * El ÚNICO lugar que monta el campo de tarjeta.
     *
     * Corre después del commit que renderiza el contenedor, así que
     * `containerRef.current` está garantizado — que es justamente lo que las
     * tres llamadas imperativas anteriores no podían garantizar.
     */
    useEffect(() => {
        if (!needsCardForm) return
        // Ya hay un campo montado y vivo: volver a montar dejaría el anterior
        // huérfano y pediría un SetupIntent de más (el endpoint no es
        // idempotente: cada llamada crea una fila de método de pago `pending`).
        if (cardElementRef.current) return
        void mountCardForm()
        // `mountCardForm` se recrea en cada render y `onSessionExpired` es una
        // prop sin memoizar: incluirlas remontaría el campo en cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsCardForm, mountGeneration])

    const handleSubmit = async () => {
        const stripe = stripeRef.current
        const card = cardElementRef.current
        const clientSecret = clientSecretRef.current
        if (!stripe || !card || !clientSecret) {
            // Antes era un `return` mudo: el huésped tocaba "Autorizar tarjeta"
            // y no pasaba absolutamente nada, sin mensaje ni pista.
            console.error("[GuaranteeCardForm] submit sin Stripe, campo o clientSecret listos")
            setProblem({
                kind: "message",
                text: "El formulario no terminó de cargarse. Recarga la página e intenta de nuevo.",
            })
            return
        }

        setSubmitting(true)
        setProblem(null)
        setPollTimedOut(false)
        try {
            const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
                payment_method: { card },
            })
            if (stripeError) {
                // Immediate client-side validation failure (e.g. a malformed card) —
                // this never reached Stripe's webhook, so the SetupIntent is still
                // good. Let the guest fix the field and resubmit, no new intent needed.
                setProblem({ kind: "message", text: stripeError.message ?? "No pudimos procesar la tarjeta." })
                return
            }
            // confirmCardSetup resolving does NOT mean the backend knows yet — only
            // its webhook does. Mark pending and poll until it confirms.
            setStatus("pending")
            onStatusChange("pending")
            await pollUntilResolved(() => mountedRef.current)
        } finally {
            setSubmitting(false)
        }
    }

    /**
     * El huésped pasó la puerta de información.
     *
     * Solo abre la puerta: el montaje lo dispara el efecto. Antes llamaba a
     * `mountCardForm()` acá mismo, cuando el contenedor todavía no estaba en el
     * DOM (el render que lo pinta no había ocurrido).
     */
    const handleContinueFromInfo = () => {
        setInfoAcknowledged(true)
    }

    /** El SetupIntent detrás de un fallo confirmado es terminal — pedir uno nuevo. */
    const handleRetry = () => {
        setProblem(null)
        setPollTimedOut(false)
        cardElementRef.current?.unmount()
        cardElementRef.current = null
        clientSecretRef.current = null
        stripeRef.current = null
        setCardMounted(false)
        setCardComplete(false)
        // El huésped ya pasó la puerta de información en el intento anterior; sin
        // esto, volver a "not_started" lo devolvería a esa pantalla.
        setInfoAcknowledged(true)
        setStatus("not_started")
        onStatusChange("not_started")
        setMountGeneration((generation) => generation + 1)
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

    const setupFailure = problem?.kind === "setup" ? describeGuaranteeSetupFailure(problem.cause) : null
    const problemText = setupFailure ? setupFailure.message : problem?.kind === "message" ? problem.text : null
    const isPending = status === "pending"

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

            {/* Este nodo NO puede desmontarse mientras el campo de Stripe viva:
                React se llevaría el iframe con él. Durante "pending" se oculta,
                no se quita, para que la tarjeta siga cargada si el sondeo termina
                en un fallo y el huésped vuelve a ver el formulario. */}
            <div
                ref={containerRef}
                hidden={isPending}
                data-testid="stripe-card-container"
                className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-3.5 focus-within:border-[var(--color-brand-purple)] focus-within:ring-2 focus-within:ring-[var(--color-brand-purple)]/20 transition-all"
            />

            {isPending ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        {pollTimedOut
                            ? <CreditCard size={16} className="text-slate-400" />
                            : <Loader2 size={16} className="animate-spin text-[var(--color-brand-purple)]" />}
                        {pollTimedOut
                            ? "Tu tarjeta sigue sin confirmarse."
                            : "Confirmando tu tarjeta…"}
                    </div>
                    {/* Única salida cuando el webhook de Stripe tarda más que la
                        ventana de sondeo: sin esto el estado quedaba en "pending"
                        para siempre y el botón de finalizar el check-in —que exige
                        la garantía "active"— no volvía a habilitarse nunca. */}
                    {pollTimedOut && (
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => void handleRecheck()}
                                className="text-xs font-semibold text-[var(--color-brand-purple)] hover:underline"
                            >
                                Volver a comprobar
                            </button>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="text-xs font-semibold text-slate-500 hover:underline"
                            >
                                Intentar con otra tarjeta
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Solo mientras el montaje siga en curso. Antes se mostraba
                        también junto al error, así que el huésped leía "Preparando
                        formulario…" sobre un formulario que ya nunca iba a llegar. */}
                    {!cardMounted && !problem && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 size={13} className="animate-spin" /> Preparando formulario…
                        </div>
                    )}

                    {status === "failed" && !setupFailure && (
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="text-xs font-semibold text-[var(--color-brand-purple)] hover:underline"
                        >
                            Intentar con otra tarjeta
                        </button>
                    )}

                    {/* Solo donde reintentar puede cambiar algo. Con la llave de
                        Stripe mal configurada, el botón sería una trampa: cada
                        toque crea otro SetupIntent y falla igual. */}
                    {setupFailure?.canRetry && (
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="text-xs font-semibold text-[var(--color-brand-purple)] hover:underline"
                        >
                            Intentar de nuevo
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
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

            {problemText && (
                <p className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>
                        {problemText}
                        {/* La referencia existe porque diagnosticar esto costó dos
                            días con un log de backend en verde: el huésped la puede
                            leer por WhatsApp sin conectar el móvil a un Mac. */}
                        {setupFailure && (
                            <span className="ml-1 text-red-400">(ref: {setupFailure.ref})</span>
                        )}
                    </span>
                </p>
            )}
        </div>
    )
}
