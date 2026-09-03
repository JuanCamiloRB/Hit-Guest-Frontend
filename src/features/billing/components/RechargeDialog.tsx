"use client"

import { useEffect, useState } from "react"
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
import { rechargeErrorDescription } from "../lib/recharge-error"
import type { PackagesInfo } from "../types"

/**
 * Solo mientras `GET /billing/packages` no haya respondido: el catálogo real de
 * montos lo define el backend ($10/$25/$50/$100 y mínimo $10, observado por
 * curl el 2026-09-03) y este diálogo mostraba $20/$40/$100 inventados del
 * front. El backend valida siempre, así que un fallback desalineado no cobra
 * mal — solo ofrece atajos distintos.
 */
const FALLBACK_AMOUNTS = [20, 40, 100]

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
    const [packagesInfo, setPackagesInfo] = useState<PackagesInfo | null>(null)

    // Los montos del backend se piden al abrir, una sola vez. Si la llamada
    // falla o la ruta no está, el diálogo sigue con el fallback: nunca se
    // bloquea la recarga por no poder listar los atajos.
    useEffect(() => {
        if (!open || packagesInfo) return
        let active = true
        billingService
            .getPackages()
            .then((info) => {
                if (!active || !info || info.packages.length === 0) return
                setPackagesInfo(info)
                // Si la selección era un preset del fallback que el backend no
                // ofrece, moverla al primer paquete real para no enviar un monto
                // que el PM no eligió a conciencia.
                setAmount((prev) =>
                    info.packages.some((pkg) => pkg.amount === prev) ? prev : info.packages[0].amount,
                )
            })
            .catch(() => {})
        return () => { active = false }
    }, [open, packagesInfo])

    const presets = packagesInfo?.packages.map((pkg) => pkg.amount) ?? FALLBACK_AMOUNTS
    // El mínimo solo se exige localmente cuando el backend lo declaró; sin ese
    // dato la única validación local es ">0" y el 422 del backend (que ahora se
    // muestra tal cual) cubre el resto. No se inventa un mínimo propio.
    const minimum = packagesInfo?.minimumCustom ?? null
    const belowMinimum = minimum !== null && amount > 0 && amount < minimum

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
                // El original al log SIEMPRE: el toast genérico es lo que vuelve
                // inaccionable el próximo reporte si nadie conservó el detalle.
                console.error("[RechargeDialog] checkout error:", error)
                toast.error("No se pudo iniciar la recarga", {
                    description: rechargeErrorDescription(error),
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
                        {presets.map((preset) => (
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
                                min={minimum ?? 1}
                                step={1}
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                aria-invalid={belowMinimum || undefined}
                                className="pl-7 font-semibold"
                            />
                        </div>
                        {minimum !== null && (
                            <p className={`text-xs ${belowMinimum ? "font-medium text-danger" : "text-slate-400"}`}>
                                El monto mínimo de recarga es ${minimum} USD.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleRecharge}
                        disabled={isSubmitting || belowMinimum}
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
