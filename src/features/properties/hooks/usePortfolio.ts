"use client"

import { useCachedLoad } from "@/hooks/useCachedLoad"
import type { Property } from "@/types"
import { portfolioCache, type PortfolioListing } from "../lib/properties-cache"

export type { PortfolioListing } from "../lib/properties-cache"

interface PortfolioState {
    properties: Property[]
    listings: PortfolioListing[]
    /** Solo la primera carga: una actualización conserva lo que se ve. */
    isLoading: boolean
    /** No hay portafolio y la carga falló: decirlo, no mostrar listas vacías. */
    loadFailed: boolean
    /** Vuelve a pedir conservando lo que se ve. */
    refresh: () => void
}

/**
 * Las propiedades de la cuenta con sus alojamientos, del endpoint agregado del
 * BFF. Comparte la caché con Propiedades: volver muestra lo último mientras se
 * refresca, y un fallo no borra lo ya cargado.
 */
export function usePortfolio(): PortfolioState {
    const { data, status, refresh } = useCachedLoad(portfolioCache)
    return {
        properties: data?.properties ?? [],
        listings: data?.listings ?? [],
        isLoading: status === "loading",
        loadFailed: status === "error",
        refresh,
    }
}
