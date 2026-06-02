"use client"

/**
 * ProgressBar — Indicador de progreso mínimo para el flujo de check-in.
 *
 * Reemplaza al StepIndicator numerado para reducir la fricción percibida.
 * No muestra números de paso ni labels — solo una barra que avanza.
 *
 * Uso:
 *   Flujo principal (main guest):  totalSteps=5 (identify→verify→guest→contract→success)
 *   Flujo secundario:              totalSteps=3 (identify→verify→guest→success) 
 *
 * currentStep: 1-indexed. 0 = oculto (WelcomeScreen no lo usa).
 */

interface ProgressBarProps {
    currentStep: number    // 1-indexed (1 = primer paso interno)
    totalSteps: number     // total de pasos internos (sin contar welcome)
    isSuccess?: boolean    // cuando está en success, fuerza color verde
}

export function ProgressBar({ currentStep, totalSteps, isSuccess = false }: ProgressBarProps) {
    const pct = Math.min(100, Math.round((currentStep / totalSteps) * 100))

    return (
        <div className="w-full space-y-1.5">
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isSuccess ? "bg-green-400" : "bg-brand-purple"
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
