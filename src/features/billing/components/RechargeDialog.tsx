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
import { Icon } from "@/components/ui/icon"
import {
    billingService,
    BillingNotConfiguredError,
} from "../services/billing-service"
import { rechargeErrorDescription } from "../lib/recharge-error"
import type { PackagesInfo } from "../types"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Label } from "@/components/ui/label"

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
    const [amount, setAmount] = useState<number | "">("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [packagesInfo, setPackagesInfo] = useState<PackagesInfo | null>(null)
    const [packagesStatus, setPackagesStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle")

    const loadPackages = () => {
        setPackagesStatus("loading")
        void billingService.getPackages()
            .then((info) => {
                if (!info || info.packages.length === 0) {
                    setPackagesInfo(null)
                    setPackagesStatus("unavailable")
                    return
                }
                setPackagesInfo(info)
                setAmount((prev) =>
                    typeof prev === "number" && info.packages.some((pkg) => pkg.amount === prev)
                        ? prev
                        : info.packages[0].amount,
                )
                setPackagesStatus("ready")
            })
            .catch(() => {
                setPackagesInfo(null)
                setPackagesStatus("unavailable")
            })
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (nextOpen && packagesStatus !== "ready" && packagesStatus !== "loading") loadPackages()
    }

    const presets = packagesInfo?.packages.map((pkg) => pkg.amount) ?? []
    // El mínimo solo se exige localmente cuando el backend lo declaró; sin ese
    // dato la única validación local es ">0" y el 422 del backend (que ahora se
    // muestra tal cual) cubre el resto. No se inventa un mínimo propio.
    const minimum = packagesInfo?.minimumCustom ?? null
    const numericAmount = typeof amount === "number" ? amount : 0
    const belowMinimum = minimum !== null && numericAmount > 0 && numericAmount < minimum
    const invalidAmount = numericAmount <= 0

    async function handleRecharge() {
        if (invalidAmount) {
            toast.error("Ingresa un monto válido")
            return
        }
        setIsSubmitting(true)
        try {
            const { paymentUrl } = await billingService.createRecharge(numericAmount)
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
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button size="sm" className="gap-1.5">
                        <Icon icon={Plus} /> Recargar
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon icon={CreditCard} size="lg" className="text-primary" />
                        Recargar bolsa
                    </DialogTitle>
                    <DialogDescription>
                        Añade saldo en USD para cubrir el consumo de tus automatizaciones.
                        El pago se procesa de forma segura.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {packagesStatus === "loading" && (
                        <p role="status" className="text-sm text-ink-3">Cargando montos disponibles…</p>
                    )}
                    {packagesStatus === "unavailable" && (
                        <div role="alert" className="rounded-lg bg-warning-sunk px-3 py-2 text-sm text-warning">
                            <p>No pudimos cargar los montos sugeridos. Puedes ingresar otro monto o reintentar.</p>
                            <UnstyledButton type="button" onClick={loadPackages} className="mt-1 font-semibold underline">
                                Reintentar
                            </UnstyledButton>
                        </div>
                    )}
                    {presets.length > 0 && (
                        <div className="flex gap-2">
                            {presets.map((preset) => (
                            <UnstyledButton
                                key={preset}
                                type="button"
                                onClick={() => setAmount(preset)}
                                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                                    amount === preset
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-rule text-ink-3 hover:border-input-hover"
                                }`}
                            >
                                ${preset}
                            </UnstyledButton>
                            ))}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label variant="plain" className="text-xs font-semibold text-ink-3">
                            Otro monto (USD)
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 font-medium">
                                $
                            </span>
                            <Input
                                type="number"
                                min={minimum ?? 1}
                                step={1}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                                aria-invalid={belowMinimum || undefined}
                                className="pl-7 font-semibold"
                            />
                        </div>
                        {minimum !== null && (
                            <p className={`text-xs ${belowMinimum ? "font-medium text-danger" : "text-ink-3"}`}>
                                El monto mínimo de recarga es ${minimum} USD.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleRecharge}
                        disabled={isSubmitting || packagesStatus === "loading" || belowMinimum || invalidAmount}
                        className="w-full gap-2 bg-primary hover:bg-primary text-white font-bold"
                    >
                        {isSubmitting && <Icon icon={Loader2} className="animate-spin" />}
                        Continuar al pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
