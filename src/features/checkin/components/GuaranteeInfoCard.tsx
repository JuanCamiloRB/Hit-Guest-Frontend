import { Check, CreditCard, Lock, Trash2, ArrowRight } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Disclosure } from "@/components/ui/disclosure"

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
                <span className="text-xs font-bold text-secondary">Antes de continuar</span>
                <p className="text-sm text-ink-3">
                    Para tu check-in, solo necesitamos registrar una tarjeta como respaldo del contrato de garantía que acabas de aceptar.
                </p>
            </div>

            {/* Lifecycle */}
            <div className="rounded-xl p-5 bg-brand-navy relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4 relative">
                    <Icon icon={CreditCard} size="sm" className="text-white" />
                    <span className="text-xs font-bold text-white">Qué pasa con tu tarjeta</span>
                </div>
                <div className="flex items-start relative">
                    <div className="absolute top-3.25 left-[16.66%] right-[16.66%] h-0.5 bg-white/20" />
                    <div className="flex-1 flex flex-col items-center text-center relative z-10">
                        <div className="w-6.5 h-6.5 rounded-full bg-white flex items-center justify-center mb-2">
                            <Icon icon={Check} size="sm" weight="bold" className="text-brand-navy" />
                        </div>
                        <p className="text-xs font-bold text-white mb-0.5">Registrada</p>
                        <p className="text-xs leading-tight text-white/70 max-w-22">Guardada de forma segura y tokenizada</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center text-center relative z-10">
                        <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center mb-2 bg-primary ring-4 ring-primary/20">
                            <Icon icon={Lock} size="xs" className="text-white" />
                        </div>
                        <p className="text-xs font-bold text-white mb-0.5">Protegida</p>
                        <p className="text-xs leading-tight text-white/70 max-w-22">Nadie ve tu número completo, ni nuestro equipo</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center text-center relative z-10">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mb-2">
                            <Icon icon={Trash2} size="xs" className="text-white" />
                        </div>
                        <p className="text-xs font-bold text-white mb-0.5">Eliminada</p>
                        <p className="text-xs leading-tight text-white/70 max-w-22">2 días después de tu check-out, automático</p>
                    </div>
                </div>
            </div>

            {/* Reassurance chips */}
            <div className="flex flex-wrap gap-2">
                <Badge tone="success">
                    <Icon icon={Check} size="sm" /> Sin cobro ahora
                </Badge>
                <Badge tone="success">
                    <Icon icon={Lock} size="sm" /> Tokenización certificada
                </Badge>
            </div>

            {/* FAQ */}
            <div className="divide-y divide-rule">
                <Disclosure title="¿Por qué piden una tarjeta?" defaultOpen>
                    <p>
                        Como respaldo del <b className="text-ink">contrato de garantía</b> que firmas en tu check-in. Protege la propiedad frente a daños y define por escrito, con montos claros, qué se puede cobrar y qué no.
                    </p>
                </Disclosure>
                <Disclosure title="¿Me cobran algo ahora?">
                    <p>
                        No. Solo se registra como garantía. Si todo está en orden al final de tu estadía, <b className="text-ink">no se cobra nada</b> y el token se elimina.
                    </p>
                </Disclosure>
                <Disclosure title="¿Cuál es el monto máximo que podrían cobrar?">
                    <p>
                        El tope está definido en el <b className="text-ink">contrato de garantía</b> que ya leíste en esta misma pantalla, junto con la política de cancelación.
                    </p>
                </Disclosure>
                <Disclosure title="¿Qué pasa si hay un daño?">
                    <p>
                        Te contactamos primero por <b className="text-ink">WhatsApp y correo electrónico</b>, con evidencia fotográfica y el monto según el contrato. Tienes oportunidad de responder antes de que se procese cualquier cargo.
                    </p>
                </Disclosure>
                <Disclosure title="¿Hasta cuándo guardan mis datos?">
                    <p>
                        El token de tu tarjeta se elimina automáticamente <b className="text-ink">2 días después de tu check-out</b>. Después de eso, no queda ningún dato tuyo en el sistema.
                    </p>
                </Disclosure>
                <Disclosure title="¿Tarjeta de crédito o débito?">
                    <p>
                        Cualquiera de las dos, siempre que tenga código de seguridad (CVV) y permita compras en línea.
                    </p>
                </Disclosure>
                <Disclosure title="¿Es seguro?">
                    <p>
                        Sí. Usamos <b className="text-ink">tokenización certificada</b>: tu número de tarjeta nunca se guarda en texto plano ni queda expuesto a nuestro equipo.
                    </p>
                </Disclosure>
            </div>

            <div className="pt-1">
                <Button size="xl"
                    type="button"
                    onClick={onContinue}
                    className="w-full flex items-center justify-center"
                >
                    Continuar con confianza
                    <Icon icon={ArrowRight} />
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-ink-3 mt-2.5">
                    <Icon icon={Lock} size="xs" /> Se elimina automáticamente 2 días después de tu check-out
                </p>
            </div>
        </div>
    )
}
