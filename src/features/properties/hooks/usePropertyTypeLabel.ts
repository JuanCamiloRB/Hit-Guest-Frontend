"use client"

import { useEffect, useState } from "react"
import { catalogService, type CatalogOption } from "@/features/auth/services/catalog-service"

/**
 * Resolves a property's `propertyTypeId` to the label the PM actually configured,
 * using the authoritative `property_type` catalog (same source as PropertyForm).
 *
 * The card previously mapped types with a hardcoded 100/101/102 switch, so any
 * other catalog id fell back to "Propiedad" (or masked as "Apartamento"), which
 * didn't match the configuration. This keeps the badge in sync with the catalog.
 *
 * The catalog is fetched once and shared across every card via a module cache.
 */
let cachedMap: Map<string, string> | null = null
let inflight: Promise<Map<string, string>> | null = null

function loadMap(): Promise<Map<string, string>> {
    if (cachedMap) return Promise.resolve(cachedMap)
    if (!inflight) {
        inflight = catalogService
            .getPropertyTypes()
            .then((opts: CatalogOption[]) => {
                cachedMap = new Map(opts.map((o) => [String(o.id), o.name]))
                return cachedMap
            })
            .catch(() => {
                inflight = null // allow a retry on a later mount
                return new Map<string, string>()
            })
    }
    return inflight
}

/** Catalog label for `typeId`, or `null` until the catalog loads / on miss. */
export function usePropertyTypeLabel(typeId?: string | number | null): string | null {
    const [map, setMap] = useState<Map<string, string> | null>(cachedMap)

    useEffect(() => {
        if (map) return
        let active = true
        loadMap().then((m) => active && setMap(m))
        return () => {
            active = false
        }
    }, [map])

    if (typeId == null || typeId === "") return null
    return map?.get(String(typeId)) ?? null
}
