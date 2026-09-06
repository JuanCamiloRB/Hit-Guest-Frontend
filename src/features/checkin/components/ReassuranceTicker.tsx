"use client"

import { useEffect, useState } from "react"
import { phraseForElapsed, type ReassurancePhrase } from "../lib/reassurance"

/**
 * Frase de espera que avanza con el tiempo (ver `lib/reassurance.ts`): el
 * huésped ve una historia en movimiento, no un texto congelado que parece un
 * loop. `aria-live="polite"` anuncia los cambios a lectores de pantalla sin
 * interrumpir; el `key` por frase re-monta el span para la transición suave.
 *
 * Cuenta desde su montaje: quien lo monta decide cuándo empieza la espera.
 */
export function ReassuranceTicker({
    script,
    className,
}: {
    script: ReassurancePhrase[]
    className?: string
}) {
    const [elapsed, setElapsed] = useState(0)
    useEffect(() => {
        const startedAt = Date.now()
        const id = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000))
        }, 1000)
        return () => clearInterval(id)
    }, [])

    const phrase = phraseForElapsed(elapsed, script)
    return (
        <p aria-live="polite" className={className}>
            <span key={phrase} className="inline-block animate-in fade-in duration-500">
                {phrase}
            </span>
        </p>
    )
}
