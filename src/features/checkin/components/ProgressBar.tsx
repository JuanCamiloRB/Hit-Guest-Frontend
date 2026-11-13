"use client"

import { Progress } from "@/components/ui/progress"

/**
 * ProgressBar — Indicador de progreso mínimo para el flujo de check-in.
 *
 * Reemplaza al StepIndicator numerado para reducir la fricción percibida.
 * No muestra números de paso ni labels — solo una barra que avanza. La barra
 * es la primitiva `Progress` (DS-8b); aquí solo vive la cuenta de pasos.
 *
 * Uso:
 *   Flujo principal (main guest):  totalSteps=5 (identify→verify→guest→contract→success)
 *   Flujo secundario:              totalSteps=3 (identify→verify→guest→success)
 *
 * currentStep: 1-indexed (WelcomeScreen no la usa). La barra cuenta los pasos
 * internos y la pantalla muestra «Paso N de M» contando la bienvenida: por eso el
 * nombre accesible es neutro y no repite una cuenta que contradiga al texto.
 */

interface ProgressBarProps {
    currentStep: number    // 1-indexed (1 = primer paso interno)
    totalSteps: number     // total de pasos internos (sin contar welcome)
    isSuccess?: boolean    // cuando está en success, fuerza color verde
}

export function ProgressBar({ currentStep, totalSteps, isSuccess = false }: ProgressBarProps) {
    return (
        <Progress
            size="xs"
            tone={isSuccess ? "success" : "primary"}
            value={currentStep}
            max={totalSteps}
            label="Avance del check-in"
            className="w-full"
        />
    )
}
