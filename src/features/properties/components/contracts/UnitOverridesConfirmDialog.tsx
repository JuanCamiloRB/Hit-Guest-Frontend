"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { AffectedUnit, UnitOverridesConfirmationRequest } from "../../lib/unit-overrides-confirmation"

/** Respaldo si el backend no mandó las frases: se arman desde `meta.affectedUnits`. */
function describeUnit(unit: AffectedUnit): string {
    const parts: string[] = []
    if (unit.replacedTexts.length > 0) {
        const channels = unit.replacedTexts.map((text) => text.channel.name).join(", ")
        parts.push(`su texto propio (${channels}) dejará de aplicar`)
    }
    if (unit.channelsLeftWithoutText.length > 0) {
        const channels = unit.channelsLeftWithoutText.map((channel) => channel.name).join(", ")
        parts.push(`su firma propia quedará sin texto para ${channels}`)
    }
    return `${unit.listingName}: ${parts.join(" y ") || "cambia su configuración del contrato"}.`
}

interface Props {
    request: UnitOverridesConfirmationRequest | null
    /** Un paso anterior del mismo guardado ya quedó aplicado: cancelar no lo deshace. */
    partial: boolean
    onDecision: (confirmed: boolean) => void
}

/**
 * 422 `confirmUnitOverrides` (contrato 2026-10-20): el backend NO aplicó el
 * cambio y espera que el PM vea qué unidades cambian. Las frases vienen ya
 * redactadas: la primera es la introducción, luego una por unidad y efecto.
 */
export function UnitOverridesConfirmDialog({ request, partial, onDecision }: Props) {
    const [intro, ...details] = request?.messages ?? []
    const lines = details.length > 0 ? details : (request?.affectedUnits ?? []).map(describeUnit)

    return (
        <AlertDialog open={request !== null} onOpenChange={(open) => { if (!open) onDecision(false) }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Este cambio afecta a algunas unidades</AlertDialogTitle>
                    <AlertDialogDescription>
                        {intro || "Este cambio reemplaza la configuración del contrato de algunas unidades. Revisa cuáles y confirma para aplicarlo."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {lines.length > 0 && (
                    <ul className="max-h-60 list-disc space-y-1.5 overflow-y-auto pl-5 text-sm text-slate-700">
                        {lines.map((line, index) => <li key={index}>{line}</li>)}
                    </ul>
                )}
                {partial && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Parte de este guardado ya se aplicó. Si cancelas, eso queda guardado y este paso no.
                    </p>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onDecision(false)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDecision(true)}>Continuar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
