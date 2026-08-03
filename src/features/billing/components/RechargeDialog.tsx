"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CreditCard, Loader2, Plus } from "lucide-react"
import {
    billingService,
    BillingNotConfiguredError,
} from "../services/billing-service"

const PRESET_AMOUNTS = [20, 40, 100]

/**
 * "Recargar bolsa" flow. Collects an amount and hands off to the hosted payment
 * page returned by the backend. The frontend is payment-provider agnostic: it
 * only opens `paymentUrl` and never references the provider.
 *
 * The backend route isn't live yet: `createRecharge` throws
 * `BillingNotConfiguredError`, which we surface as an honest toast instead of a
 * broken redirect. When the backend ships, the redirect below just works.
 */
export function RechargeDialog({ trigger }: { trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [amount, setAmount] = useState<number>(40)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleRecharge() {
        if (!amount || amount <= 0) {
            toast.error("Ingresa un monto válido")
            return
        }
        setIsSubmitting(true)
        try {
            const { paymentUrl } = await billingService.createRecharge(amount)
            window.location.href = paymentUrl
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) {
                toast.info("Recarga — próximamente", {
                    description:
                        "El pago aún no está habilitado. Falta conectar el backend de pagos.",
                })
            } else {
                toast.error("No se pudo iniciar la recarga", {
                    description: "Inténtalo de nuevo en unos minutos.",
                })
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button size="sm" className="gap-1.5">
                        <Plus className="h-4 w-4" /> Recargar
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-[var(--color-brand-purple)]" />
                        Recargar bolsa
                    </DialogTitle>
                    <DialogDescription>
                        Añade saldo en USD para cubrir el consumo de tus automatizaciones.
                        El pago se procesa de forma segura.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex gap-2">
                        {PRESET_AMOUNTS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setAmount(preset)}
                                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                                    amount === preset
                                        ? "border-[var(--color-brand-purple)] bg-[var(--color-brand-purple)]/5 text-[var(--color-brand-purple)]"
                                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}
                            >
                                ${preset}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Otro monto (USD)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                                $
                            </span>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                className="pl-7 font-semibold"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleRecharge}
                        disabled={isSubmitting}
                        className="w-full gap-2 bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-white font-bold"
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Continuar al pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
