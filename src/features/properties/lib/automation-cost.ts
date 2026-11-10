/**
 * Qué cuesta una automatización, dicho con lo que manda el backend.
 *
 * La tarifa sale de `provider.parameters.billing` (`GET /providers`); Finanzas
 * la cambia con un UPDATE, sin despliegue, así que nunca se escribe en el front.
 */
import { formatUsdRate } from "@/features/billing/types"
import type { ProviderBilling } from "../types/automation"

/**
 * La unidad de cobro según `billing.scope`. Solo las que el backend documentó:
 * un `scope` desconocido muestra el monto sin unidad antes que inventarle una.
 */
const SCOPE_UNIT: Record<string, string> = {
    per_execution: "cada vez que se ejecuta",
}

/**
 * - sin tarifa en el catálogo → «Puede generar costo» (no se afirma ni se niega)
 * - `billable: false` → «Sin costo»
 * - tarifa 0 → «Sin costo por ahora» (`0,00 USD` se lee como error)
 * - tarifa positiva → monto con hasta 4 decimales y su unidad, si se conoce
 *   y `withUnit` no la apaga (ver `AutomationDefinition.hideCostUnit`)
 */
export function describeAutomationCost(
    billing: ProviderBilling | null | undefined,
    options: { withUnit?: boolean } = {},
): string {
    if (!billing) return "Puede generar costo"
    if (!billing.billable) return "Sin costo"
    if (billing.unit_cost === 0) return "Sin costo por ahora"
    // `hasOwn`: un `scope` como "toString" no debe leer el prototipo.
    const unit = options.withUnit !== false && billing.scope && Object.hasOwn(SCOPE_UNIT, billing.scope)
        ? SCOPE_UNIT[billing.scope]
        : undefined
    const amount = formatUsdRate(billing.unit_cost)
    return unit ? `${amount} ${unit}` : amount
}
