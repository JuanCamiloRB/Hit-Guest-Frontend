import { Check, CreditCard, Lock, Trash2, ArrowRight } from "lucide-react"

interface GuaranteeInfoCardProps {
    onContinue: () => void
}

/**
 * "Antes de continuar" gate shown before the guarantee card is tokenized with
 * Stripe (Ricardo/Didier thread 20260801 — mockup garantia_tarjeta.html).
 * Purely informational: explains the card's lifecycle (registered → protected
 * → deleted 2 days post-checkout) and answers the FAQs guests actually ask
 * before handing over a card. No network call happens until `onContinue` is
 * clicked — that's the whole point of gating it here, before
 * createGuaranteeSetupIntent (the actual Stripe tokenization kickoff).
 *
 * The mockup shows a specific {{max_claim_amount}} in one FAQ answer, but that
 * number only comes back from createGuaranteeSetupIntent — which hasn't been
 * called yet at this point. Rather than firing that call early just to fill in
 * a number (defeating the gate), this points back to the guarantee text the
 * guest already read moments earlier in the same screen, which the backend
 * renders with the real amount already resolved.
 */
export function GuaranteeInfoCard({ onContinue }: GuaranteeInfoCardProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <span className="text-[11px] font-bold tracking-wider text-brand-blue uppercase">Antes de continuar</span>
                <p className="text-sm text-slate-500">
                    Para tu check-in, solo necesitamos registrar una tarjeta como respaldo del contrato de garantía que acabas de aceptar.
                </p>
            </div>

            {/* Lifecycle */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-brand-navy to-[#2E3373] relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 relative">
                    <CreditCard size={14} className="text-white" />
                    <span className="text-[11px] font-bold tracking-wide text-white uppercase">Qué pasa con tu tarjeta</span>
                </div>
                <div className="flex items-start relative">
                    <div className="absolute top-[13px] left-[16.66%] right-[16.66%] h-0.5 bg-white/25" />
                    <div className="flex-1 flex flex-col items-center text-center relative z-10">
                        <div className="w-[26px] h-[26px] rounded-full bg-white flex items-center justify-center mb-2">
                            <Check size={13} className="text-brand-navy" strokeWidth={3} />
                        </div>
                        <p className="text-[11.5px] font-bold text-white mb-0.5">Registrada</p>
                        <p className="text-[10px] leading-tight text-white/65 max-w-[88px]">Guardada de forma segura y tokenizada</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center text-center relative z-10">
                        <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center mb-2 bg-gradient-to-br from-brand-purple to-brand-blue ring-4 ring-brand-purple/25">
                            <Lock size={12} className="text-white" />
                        </div>
                        <p className="text-[11.5px] font-bold text-white mb-0.5">Protegida</p>
                        <p className="text-[10px] leading-tight text-white/65 max-w-[88px]">Nadie ve tu número completo, ni nuestro equipo</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center text-center relative z-10">
                        <div className="w-[26px] h-[26px] rounded-full bg-white/10 border-2 border-white/35 flex items-center justify-center mb-2">
                            <Trash2 size={12} className="text-white" />
                        </div>
                        <p className="text-[11.5px] font-bold text-white mb-0.5">Eliminada</p>
                        <p className="text-[10px] leading-tight text-white/65 max-w-[88px]">2 días después de tu check-out, automático</p>
                    </div>
                </div>
            </div>

            {/* Reassurance chips */}
            <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Check size={13} /> Sin cobro ahora
                </span>
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Lock size={13} /> Tokenización certificada
                </span>
            </div>

            {/* FAQ */}
            <div className="divide-y divide-slate-100">
                <details className="group py-1" open>
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Por qué piden una tarjeta?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        Como respaldo del <b className="text-slate-800">contrato de garantía</b> que firmas en tu check-in. Protege la propiedad frente a daños y define por escrito, con montos claros, qué se puede cobrar y qué no.
                    </p>
                </details>
                <details className="group py-1">
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Me cobran algo ahora?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        No. Solo se registra como garantía. Si todo está en orden al final de tu estadía, <b className="text-slate-800">no se cobra nada</b> y el token se elimina.
                    </p>
                </details>
                <details className="group py-1">
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Cuál es el monto máximo que podrían cobrar?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        El tope está definido en el <b className="text-slate-800">contrato de garantía</b> que ya leíste en esta misma pantalla, junto con la política de cancelación.
                    </p>
                </details>
                <details className="group py-1">
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Qué pasa si hay un daño?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        Te contactamos primero por <b className="text-slate-800">WhatsApp y correo electrónico</b>, con evidencia fotográfica y el monto según el contrato. Tienes oportunidad de responder antes de que se procese cualquier cargo.
                    </p>
                </details>
                <details className="group py-1">
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Hasta cuándo guardan mis datos?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        El token de tu tarjeta se elimina automáticamente <b className="text-slate-800">2 días después de tu check-out</b>. Después de eso, no queda ningún dato tuyo en el sistema.
                    </p>
                </details>
                <details className="group py-1">
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Tarjeta de crédito o débito?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        Cualquiera de las dos, siempre que tenga código de seguridad (CVV) y permita compras en línea.
                    </p>
                </details>
                <details className="group py-1">
                    <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer font-bold text-sm text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                        <span>¿Es seguro?</span>
                        <ArrowRight size={14} className="shrink-0 text-slate-300 group-open:rotate-90 transition-transform" />
                    </summary>
                    <p className="pb-3 text-[13.5px] leading-relaxed text-slate-500">
                        Sí. Usamos <b className="text-slate-800">tokenización certificada</b>: tu número de tarjeta nunca se guarda en texto plano ni queda expuesto a nuestro equipo.
                    </p>
                </details>
            </div>

            <div className="pt-1">
                <button
                    type="button"
                    onClick={onContinue}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-brand-purple to-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-purple/25 active:scale-[0.98] transition-all"
                >
                    Continuar con confianza
                    <ArrowRight size={16} />
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-2.5">
                    <Lock size={11} /> Se elimina automáticamente 2 días después de tu check-out
                </p>
            </div>
        </div>
    )
}
