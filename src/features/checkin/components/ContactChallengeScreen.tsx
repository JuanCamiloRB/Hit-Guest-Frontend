"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Mail, Loader2, ShieldCheck, RotateCcw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { setVerificationToken } from "@/features/checkin/lib/verification-token"
import { asCheckinError } from "@/features/checkin/lib/checkin-error"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import type { IdentifySessionData, ContactChallengeDirective } from "@/features/checkin/types/checkin"

interface ContactChallengeScreenProps {
    reservationUuid: string
    guestUuid: string
    basePath: string
    isSecondary?: boolean
}

/**
 * Cuánto esperar tras un 429 cuando el backend no dice cuánto.
 *
 * El contrato (§8/§9) tiene DOS 429 distintos en estos endpoints: el lógico del
 * propio challenge, que trae `code: "TOO_MANY_ATTEMPTS"` y `retryAfter`, y el
 * del throttle de Laravel, que no trae ninguno de los dos. El servicio ya
 * rescata el header `Retry-After` cuando existe, así que este valor solo se usa
 * si tampoco vino ahí — y entonces el throttle (1 min en /resend, 10/min en
 * /verify) es la hipótesis correcta. Antes se asumía 900 s: quince minutos de
 * castigo por un bloqueo de uno.
 */
const FALLBACK_RETRY_AFTER_SECONDS = 60

/** Segundos de espera declarados por el backend, o el fallback de arriba. */
function retryAfterSeconds(error: { retryAfter?: number }): number {
    return typeof error?.retryAfter === "number" && error.retryAfter > 0
        ? error.retryAfter
        : FALLBACK_RETRY_AFTER_SECONDS
}

/**
 * OTP screen for the "posesión de contacto" security fix (backend plan
 * 20260731): a recurring guest whose identity verification is being reused
 * must prove they still control the historical email before that shortcut is
 * honored. Mirrors VerifyScreen's session-loading and layout conventions.
 *
 * All countdowns come from the backend (`expiresIn`, `resendAfter`,
 * `retryAfter`) — never hardcoded, since backend config can change these
 * without a frontend release (plan §"Constantes actuales").
 */
export function ContactChallengeScreen({ reservationUuid, guestUuid, basePath, isSecondary = false }: ContactChallengeScreenProps) {
    const router = useRouter()
    const { load, saveRaw, clear } = useIdentifySession(reservationUuid)

    const [session, setSession] = useState<IdentifySessionData | null>(null)
    const [sessionLoaded, setSessionLoaded] = useState(false)

    const [code, setCode] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [resending, setResending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
    // "idle": entrada normal. "must_resend": el código murió (vencido/usado/
    // reemplazado por otro reenvío, 410) — entrada deshabilitada hasta pedir uno
    // nuevo.
    //
    // El bloqueo por intentos agotados (429) NO vive acá: es `blockedUntil`, una
    // marca de tiempo, y se DERIVA comparándola con el reloj. Antes era un tercer
    // valor de este enum y nada lo devolvía a "idle" cuando la espera terminaba:
    // el contador llegaba a cero y la entrada seguía muerta hasta recargar.
    // Derivándolo, ese bug no se puede volver a escribir.
    const [phase, setPhase] = useState<"idle" | "must_resend">("idle")
    const [notFound, setNotFound] = useState(false)

    // Countdown targets as absolute timestamps (survive re-renders without drifting).
    const [resendAvailableAt, setResendAvailableAt] = useState<number>(0)
    const [blockedUntil, setBlockedUntil] = useState<number>(0)
    const [now, setNow] = useState(() => Date.now())
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        tickRef.current = setInterval(() => setNow(Date.now()), 1000)
        return () => { if (tickRef.current) clearInterval(tickRef.current) }
    }, [])

    // Load session from localStorage after mount (avoid SSR hydration mismatch,
    // same pattern as VerifyScreen).
    // localStorage no existe en el servidor: leerlo durante el render daría un
    // árbol distinto al que el servidor mandó y React descartaría la hidratación.
    // Por eso se lee al montar y se refleja en estado — es el caso que la regla
    // no puede distinguir de una cascada de renders accidental.
    useEffect(() => {
        const loaded = load(guestUuid || undefined)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession(loaded)
        setSessionLoaded(true)
        const verif = loaded?.verification
        if (verif?.type === "contact_challenge") {
            setResendAvailableAt(Date.now() + verif.resendAfter * 1000)
            setAttemptsRemaining(verif.attemptsRemaining)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guestUuid])

    useEffect(() => {
        if (!sessionLoaded) return
        if (!guestUuid) router.replace(`${basePath}/identify`)
    }, [sessionLoaded, guestUuid, basePath, router])

    const challenge = session?.verification?.type === "contact_challenge"
        ? (session.verification as ContactChallengeDirective)
        : null

    const resendCountdown = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
    const blockedCountdown = Math.max(0, Math.ceil((blockedUntil - now) / 1000))

    /** Bloqueado por intentos agotados: cierto solo mientras la espera corre. */
    const isBlocked = blockedCountdown > 0

    /** Persists the current challengeId/masked destination/countdowns so a reload keeps them. */
    const persistChallenge = (patch: Partial<ContactChallengeDirective>) => {
        if (!session || session.verification.type !== "contact_challenge") return
        const updated: IdentifySessionData = {
            ...session,
            verification: { ...session.verification, ...patch },
        }
        saveRaw(updated)
        setSession(updated)
    }

    const handleVerify = async () => {
        if (!challenge || code.length !== 6 || submitting) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await checkinService.verifyContactChallenge(reservationUuid, challenge.challengeId, code)
            // `expiresAt` se guarda junto al token (no se descarta): es lo único
            // que le permite al resto del flujo saber que la credencial murió
            // ANTES de gastar el trabajo del huésped contra un 401.
            const stored = setVerificationToken(
                reservationUuid, guestUuid, res.verificationToken, res.expiresAt,
            )
            if (!stored) {
                // El código era correcto, pero nos quedamos sin la credencial que
                // exigen /form, /sign y ambos /complete. Seguir al formulario
                // garantizaría un 401 que lo devolvería acá, a repetir un código
                // que ya funcionó: el bucle que el huésped no puede romper.
                // Se corta acá y se le dice la verdad.
                setError(
                    "Verificamos tu código, pero no pudimos guardar la sesión en este navegador. "
                    + "Si estás en modo privado, ábrelo en una ventana normal; si no, contacta al anfitrión.",
                )
                return
            }
            toast.success("Código verificado")
            router.push(`${basePath}/guest?guest_uuid=${guestUuid}`)
        } catch (raw: unknown) {
            const e = asCheckinError(raw)
            if (e.status === 422 && e.code === "INVALID_CODE") {
                setAttemptsRemaining(typeof e.attemptsRemaining === "number" ? e.attemptsRemaining : null)
                setError(e.message || "El código ingresado no es válido.")
                setCode("")
            } else if (e.status === 410) {
                setPhase("must_resend")
                setError("El código de verificación venció. Pide uno nuevo.")
            } else if (e.status === 429) {
                setBlockedUntil(Date.now() + retryAfterSeconds(e) * 1000)
                setError(e.message || "Superaste el número permitido de intentos.")
            } else if (e.status === 404) {
                setNotFound(true)
            } else {
                setError(e.message || "No pudimos verificar el código. Intenta de nuevo.")
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleResend = async () => {
        if (!challenge || resending || resendCountdown > 0) return
        setResending(true)
        setError(null)
        try {
            const res = await checkinService.resendContactChallenge(reservationUuid, challenge.challengeId)
            persistChallenge({
                challengeId: res.challengeId,
                maskedDestination: res.maskedDestination,
                expiresIn: res.expiresIn,
                resendAfter: res.resendAfter,
                // El reenvío no informa cuántos intentos quedan. Antes se
                // guardaba un 5 fijo, que se mostraba como si fuera dato real del
                // backend; queda en desconocido hasta que un intento fallido
                // devuelva la cifra verdadera.
                attemptsRemaining: null,
                // Reenviar SÍ manda un correo nuevo: el modo "reingresa el código
                // anterior" (alreadyVerified) deja de aplicar.
                alreadyVerified: false,
            })
            setResendAvailableAt(Date.now() + res.resendAfter * 1000)
            setAttemptsRemaining(null)
            setPhase("idle")
            setCode("")
            toast.success("Te enviamos un nuevo código")
        } catch (raw: unknown) {
            const e = asCheckinError(raw)
            if (e.status === 429) {
                setResendAvailableAt(Date.now() + retryAfterSeconds(e) * 1000)
                setError(e.message || "Espera antes de pedir otro código.")
            } else if (e.status === 410) {
                setNotFound(true)
            } else {
                setError(e.message || "No pudimos reenviar el código. Intenta de nuevo.")
            }
        } finally {
            setResending(false)
        }
    }

    const handleBackToIdentify = () => {
        clear(guestUuid || undefined)
        router.push(`${basePath}/identify?guest_uuid=${guestUuid}`)
    }

    if (!sessionLoaded) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={32} className="animate-spin text-brand-purple" />
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 pb-24 text-center px-4 animate-in fade-in duration-500">
                <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center border border-red-100">
                    <XCircle size={40} className="text-red-400" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">Sesión de verificación no encontrada</h2>
                    <p className="text-slate-500 text-sm max-w-xs">Vuelve a identificarte para recibir un nuevo código.</p>
                </div>
                <button
                    onClick={handleBackToIdentify}
                    className="flex items-center gap-2 h-12 px-6 bg-brand-purple text-white rounded-xl font-semibold transition-all active:scale-[0.98]"
                >
                    <RotateCcw size={18} />
                    Volver a identificarme
                </button>
            </div>
        )
    }

    if (!challenge) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
                <p className="text-slate-500 text-sm">Sesión expirada. Vuelve a identificarte.</p>
                <Link href={`${basePath}/identify`} className="text-brand-purple font-semibold underline">
                    Volver al inicio
                </Link>
            </div>
        )
    }

    const canResend = !isBlocked && resendCountdown === 0 && !resending
    const inputDisabled = phase === "must_resend" || isBlocked || submitting

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={2} totalSteps={isSecondary ? 3 : 5} />

            <div className="flex items-center justify-between">
                <Link href={basePath} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {isSecondary ? "Paso 2 de 4" : "Paso 3 de 6"}
                </div>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    Confirma que eres tú
                </h1>
                {/* `alreadyVerified` (2026-08-24): /identify está retomando un
                    challenge ya resuelto — NO se envió correo nuevo. Decir
                    "enviamos" haría al huésped esperar un correo que no llega. */}
                <p className="text-slate-500 text-sm">
                    {challenge.alreadyVerified
                        ? <>Ya habías verificado este código. Reingresa el código de 6 dígitos
                            que te enviamos antes a <strong>{challenge.maskedDestination}</strong> —
                            no te enviamos uno nuevo.</>
                        : <>Ya tienes una verificación de identidad previa. Para reutilizarla, ingresa el código de 6 dígitos
                            que enviamos a <strong>{challenge.maskedDestination}</strong>.</>}
                </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-purple/10 w-12 h-12 rounded-xl flex items-center justify-center border border-brand-purple/20 shrink-0">
                        <Mail size={20} className="text-brand-purple" />
                    </div>
                    <p className="text-xs text-slate-500">
                        {challenge.alreadyVerified
                            // En este modo el countdown es la ventana de sesión, no
                            // la vida del código: afirmar que "vence en minutos"
                            // empujaría a pedir un reenvío innecesario.
                            ? "Busca el correo que ya te llegó. Si no lo encuentras, pide un código nuevo."
                            : "El código vence en unos minutos. Si no lo ves, revisa spam o pide uno nuevo."}
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Código de verificación</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={code}
                        disabled={inputDisabled}
                        onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all disabled:opacity-50 ${error ? "border-red-400" : "border-slate-200"}`}
                        placeholder="······"
                        maxLength={6}
                    />
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    {phase === "idle" && !isBlocked && attemptsRemaining !== null && attemptsRemaining < 5 && (
                        <p className="text-xs text-slate-400">Intentos restantes: {attemptsRemaining}</p>
                    )}
                    {isBlocked && (
                        <p className="text-xs text-amber-600 font-medium">
                            Podrás intentar de nuevo en {Math.ceil(blockedCountdown / 60)} min.
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleResend}
                    disabled={!canResend}
                    className="text-xs font-semibold text-brand-purple hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
                >
                    {resending
                        ? "Enviando..."
                        : resendCountdown > 0
                            ? `Reenviar código (${resendCountdown}s)`
                            : "Reenviar código"}
                </button>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <button
                        onClick={handleVerify}
                        disabled={inputDisabled || code.length !== 6}
                        className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <><Loader2 className="animate-spin" size={20} /> Verificando...</>
                        ) : (
                            <><ShieldCheck size={20} /> Verificar código</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
