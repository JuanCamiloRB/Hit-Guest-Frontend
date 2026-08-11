import { AUTOMATION_STATUS, type AutomationStatus } from "../types/automation"

/**
 * Laravel puede serializar ids numéricos como número o como cadena según el
 * cast aplicado al Resource. La UI necesita una representación canónica para
 * no mostrar una automatización activa (`"8"`) como apagada (`"8" !== 8`).
 */
export function normalizeAutomationStatus(value: unknown): AutomationStatus {
    const numeric = Number(value)
    return numeric === AUTOMATION_STATUS.ACTIVE
        ? AUTOMATION_STATUS.ACTIVE
        : AUTOMATION_STATUS.INACTIVE
}

/** Convierte un id opcional; valores ausentes o inválidos quedan en `null`. */
export function normalizeOptionalId(value: unknown): number | null {
    if (value == null || value === "") return null
    const numeric = Number(value)
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

/** Orden de ejecución seguro para ordenar y clasificar automatizaciones. */
export function normalizeExecutionOrder(value: unknown): number {
    const numeric = Number(value)
    return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0
}
