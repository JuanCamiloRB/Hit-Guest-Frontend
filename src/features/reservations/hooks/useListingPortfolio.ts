"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { portfolioCache, type Portfolio } from "@/features/properties/lib/properties-cache"

/** Respuesta «sin datos»: con ella las filas sin resolver dicen que no hay propiedad. */
const EMPTY_PORTFOLIO: Portfolio = { properties: [], listings: [], overview: {} }

/**
 * El portafolio (propiedades + alojamientos, una petición al BFF) para poner
 * nombres a las filas de reservas, sin estar en su camino crítico.
 *
 * - `null`: todavía no respondió; las filas van con lo que trajo la reserva.
 * - Un portafolio: ya respondió. Si falló, uno vacío: la fila sin propiedad
 *   pasa de «cargando» (vacío) a «Propiedad no disponible».
 *
 * Se pide solo si no está cargado (se invalida al editar propiedades) y se
 * reintenta al volver a la pestaña si había fallado.
 */
export function useListingPortfolio(): Portfolio | null {
    const portfolio = useSyncExternalStore(portfolioCache.subscribe, portfolioCache.read, () => null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let active = true
        const ensure = () => {
            if (portfolioCache.read()) return
            portfolioCache.load().then(
                () => { if (active) setFailed(false) },
                (error: unknown) => {
                    if (!active) return
                    console.warn("[useListingPortfolio] sin nombres de propiedad y alojamiento:", error)
                    setFailed(true)
                },
            )
        }
        ensure()
        const onVisibility = () => { if (document.visibilityState === "visible") ensure() }
        document.addEventListener("visibilitychange", onVisibility)
        return () => {
            active = false
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [])

    return portfolio ?? (failed ? EMPTY_PORTFOLIO : null)
}
