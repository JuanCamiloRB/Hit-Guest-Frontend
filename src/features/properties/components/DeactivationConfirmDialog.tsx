"use client"

import { useRef } from "react"
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
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DeactivationTarget {
    kind: "property" | "listing"
    name: string
}

/**
 * Texto EXACTO del contrato 2026-10-27 §3 (es). El panel hoy solo está en
 * español; las versiones en/pt están en el skill de contratos (§2a-bis).
 * La propiedad es «lo mismo que el alojamiento» con el género ajustado, más
 * dos líneas propias.
 */
const LISTING_CONSEQUENCES = [
    "Se detienen las automatizaciones de sus reservas confirmadas, en curso e incompletas.",
    "Los huéspedes que no hayan terminado su check-in no podrán continuarlo, y no se envían links de check-in.",
    "No se podrán crear, mover, reactivar ni restaurar reservas en él.",
    "Las reservas que lleguen de tu PMS o calendario se siguen registrando, pero no se operan.",
    "Lo que ya se ejecutó no se revierte: los códigos de acceso enviados siguen funcionando hasta la salida y los contratos enviados siguen vigentes.",
    "Sus reservas quedan en pausa: si sigue inactivo 30 días después de la salida, pasan a abandonadas o incompletas.",
    "Al reactivarlo, nada se ejecuta solo: reenvía los links de check-in.",
] as const

const PROPERTY_CONSEQUENCES = [
    "Se detienen las automatizaciones de sus reservas confirmadas, en curso e incompletas.",
    "Los huéspedes que no hayan terminado su check-in no podrán continuarlo, y no se envían links de check-in.",
    "No se podrán crear, mover, reactivar ni restaurar reservas en ella.",
    "Las reservas que lleguen de tu PMS o calendario se siguen registrando, pero no se operan.",
    "Lo que ya se ejecutó no se revierte: los códigos de acceso enviados siguen funcionando hasta la salida y los contratos enviados siguen vigentes.",
    "Sus reservas quedan en pausa: si sigue inactiva 30 días después de la salida, pasan a abandonadas o incompletas.",
    "Al reactivarla, nada se ejecuta solo: reenvía los links de check-in.",
    "Se desactivan todos sus alojamientos activos; al reactivar la propiedad vuelven esos mismos (los que desactivaste a mano siguen inactivos).",
    "Mientras esté inactiva, no podrás activar, crear activos, mover ni restaurar alojamientos en ella.",
] as const

const COPY = {
    property: { title: "¿Desactivar esta propiedad?", lead: "Al desactivar esta propiedad:", consequences: PROPERTY_CONSEQUENCES },
    listing: { title: "¿Desactivar este alojamiento?", lead: "Al desactivar este alojamiento:", consequences: LISTING_CONSEQUENCES },
} as const

interface Props {
    target: DeactivationTarget | null
    onConfirm: () => void
    onCancel: () => void
}

/**
 * Confirmación al pasar de activo a inactivo (pedido de Didier, contrato
 * 2026-10-27). Activar no la necesita. Es la única vez que el PM se entera de
 * todo lo que se detiene. ⚠️ Falta el conteo de reservas afectadas: espera una
 * clave estable de los estados de reserva (skill de contratos, §2a-bis).
 */
export function DeactivationConfirmDialog({ target, onConfirm, onCancel }: Props) {
    const copy = target ? COPY[target.kind] : null
    // Al confirmar, Radix también cierra el diálogo (`onOpenChange(false)`):
    // sin esto, confirmar dispararía además `onCancel`.
    const confirmed = useRef(false)

    return (
        <AlertDialog
            open={target !== null}
            onOpenChange={(open) => {
                if (open) return
                if (confirmed.current) confirmed.current = false
                else onCancel()
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        <span className="font-semibold text-slate-800">{target?.name}</span>
                        <span className="mt-2 block">{copy?.lead}</span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <ul className="max-h-[50vh] list-disc space-y-1.5 overflow-y-auto pl-5 text-sm text-slate-700">
                    {copy?.consequences.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <AlertDialogFooter>
                    {/* Radix enfoca «Cancelar» al abrir: confirmar exige un clic deliberado. */}
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        className={cn(buttonVariants({ variant: "destructive" }))}
                        onClick={() => {
                            confirmed.current = true
                            onConfirm()
                        }}
                    >
                        Desactivar y detener automatizaciones
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
