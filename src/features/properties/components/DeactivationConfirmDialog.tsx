"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { reservationsService } from "@/features/reservations/services/reservations-service"
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
    /** Para contar las reservas afectadas; sin él (unidad nueva) no se cuenta. */
    uuid?: string
}

type AffectedCount = { key: string; total: number } | { key: string; failed: true }

/**
 * Reservas afectadas (contrato 2026-10-27 §2.6). Se pide solo con el diálogo
 * abierto y se descarta si se cierra antes. Un fallo no frena la
 * desactivación: el backend sigue siendo la autoridad.
 */
function useAffectedCount(target: DeactivationTarget | null) {
    const key = target?.uuid ? `${target.kind}:${target.uuid}` : null
    const [result, setResult] = useState<AffectedCount | null>(null)

    useEffect(() => {
        if (!target?.uuid || !key) return
        const controller = new AbortController()
        const scope = target.kind === "listing" ? { listingUuid: target.uuid } : { propertyUuid: target.uuid }
        reservationsService.countAffectedReservations(scope, controller.signal)
            .then((total) => setResult({ key, total }))
            .catch((error) => {
                if (controller.signal.aborted) return
                console.error("[DeactivationConfirmDialog] count error:", error)
                setResult({ key, failed: true })
            })
        return () => controller.abort()
    }, [key, target?.kind, target?.uuid])

    if (!key) return null
    return result?.key === key ? result : "loading" as const
}

function affectedLine(count: ReturnType<typeof useAffectedCount>, kind: DeactivationTarget["kind"]): string | null {
    if (count === null) return null
    if (count === "loading") return "Calculando las reservas afectadas…"
    if ("failed" in count) return "No pudimos calcular cuántas reservas están afectadas."
    if (count.total === 0) {
        return kind === "listing"
            ? "Ninguna reserva confirmada, en curso o incompleta de este alojamiento se ve afectada."
            : "Ninguna reserva confirmada, en curso o incompleta de esta propiedad se ve afectada."
    }
    return count.total === 1
        ? "Se pausarán las automatizaciones de 1 reserva afectada."
        : `Se pausarán las automatizaciones de ${count.total} reservas afectadas.`
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
 * todo lo que se detiene, con cuántas reservas afectadas hay.
 */
export function DeactivationConfirmDialog({ target, onConfirm, onCancel }: Props) {
    const copy = target ? COPY[target.kind] : null
    const count = useAffectedCount(target)
    const countLine = target ? affectedLine(count, target.kind) : null
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
                {countLine && (
                    <p
                        role="status"
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
                            count !== null && count !== "loading" && "total" in count && count.total > 0
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-50 text-slate-600",
                        )}
                    >
                        {count === "loading" && <Loader2 size={14} className="animate-spin" aria-hidden />}
                        {countLine}
                    </p>
                )}
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
