"use client"

import { useCallback, useRef, useState } from "react"
import { propertiesService } from "@/features/properties/services/properties-service"
import { listingsService } from "@/features/properties/services/listings-service"
import { catalogService } from "@/features/auth/services/catalog-service"
import { readRecordStatus, type RecordStatus } from "@/features/properties/lib/record-status"

export interface PropertyOption {
    uuid: string
    name: string
    id: number
    /** Solo se reserva en una activa; `unknown` cuenta como no activa. */
    status: RecordStatus
}

export interface ListingOption {
    id: number
    uuid: string
    name: string
    propertyUuid?: string
    status: RecordStatus
}

export interface SourceOption {
    id: number
    name: string
    code?: string
}

export interface CountryOption {
    id: number | string
    name: string
    extra?: { emoji?: string } | null
}

export interface CurrencyOption {
    id: string
    name: string
}

/**
 * Catálogos que no cargaron. Propiedad y nacionalidad son obligatorias: un
 * selector vacío sin aviso dejaba al PM bloqueado sin saber por qué.
 */
export interface CatalogFailures {
    properties: boolean
    countries: boolean
    currencies: boolean
}

export interface CatalogLoading {
    properties: boolean
    listings: boolean
    sources: boolean
    countries: boolean
    currencies: boolean
}

/** Referencia real de propiedad de un alojamiento, en todas sus formas. */
function propRefOf(l: Record<string, unknown>): string | null {
    const property = l.property as Record<string, unknown> | undefined
    const ref = l.property_uuid ?? l.propertyUuid ?? property?.uuid ?? l.property_id ?? l.propertyId
    return ref == null ? null : String(ref)
}

/**
 * Los catálogos del formulario de reserva, cada uno con su propia espera
 * (antes un solo `isLoading` servía para cargar la reserva, los catálogos y
 * enviar, y deshabilitaba el teléfono mientras tanto).
 *
 * Alojamientos: solo escribe la ÚLTIMA petición. Cambiar rápido de propiedad
 * dejaba en la lista los alojamientos de la propiedad anterior si su respuesta
 * llegaba después.
 */
export function useReservationCatalogs() {
    const [properties, setProperties] = useState<PropertyOption[]>([])
    const [listings, setListings] = useState<ListingOption[]>([])
    const [sources, setSources] = useState<SourceOption[]>([])
    const [countries, setCountries] = useState<CountryOption[]>([])
    const [currencies, setCurrencies] = useState<CurrencyOption[]>([])
    const [loading, setLoading] = useState<CatalogLoading>({
        properties: false, listings: false, sources: false, countries: false, currencies: false,
    })
    // Sin catálogo de canales no se crea la reserva: nunca un id supuesto.
    const [sourcesFailed, setSourcesFailed] = useState(false)
    const [failed, setFailed] = useState<CatalogFailures>({ properties: false, countries: false, currencies: false })
    const setFailure = useCallback((key: keyof CatalogFailures, value: boolean) => {
        setFailed((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
    }, [])
    const listingsRequestRef = useRef(0)

    const setFlag = useCallback((key: keyof CatalogLoading, value: boolean) => {
        setLoading((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
    }, [])

    const loadProperties = useCallback(async () => {
        setFlag("properties", true)
        try {
            const data = await propertiesService.list()
            setProperties(
                (data as unknown as Array<Record<string, unknown>>).map((p) => ({
                    uuid: String(p.uuid),
                    name: String(p.name ?? ""),
                    id: Number(p.id),
                    status: readRecordStatus(p),
                })),
            )
            setFailure("properties", false)
        } catch (error) {
            console.error("[ReservationDialog] Error loading properties:", error)
            setFailure("properties", true)
        } finally {
            setFlag("properties", false)
        }
    }, [setFlag, setFailure])

    const loadListings = useCallback(async (propertyUuid: string) => {
        const request = ++listingsRequestRef.current
        if (!propertyUuid) {
            setListings([])
            setFlag("listings", false)
            return
        }
        setFlag("listings", true)
        try {
            const data = await listingsService.listByProperty(propertyUuid)
            if (request !== listingsRequestRef.current) return
            const list = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>
            // El backend devuelve TODOS los alojamientos del PM ignorando el
            // filtro: se acota aquí. Uno sin referencia de propiedad se conserva
            // (no se puede atribuir); uno de OTRA propiedad se descarta.
            const scoped = list.filter((l) => {
                const ref = propRefOf(l)
                return ref === null || ref === String(propertyUuid)
            })
            setListings(
                scoped.map((l) => ({
                    id: Number(l.id),
                    uuid: String(l.uuid || l.id),
                    name: String(l.name || l.internal_name || `Alojamiento ${l.id || String(l.uuid ?? "").slice(0, 8)}`),
                    propertyUuid: propRefOf(l) ?? propertyUuid,
                    status: readRecordStatus(l),
                })),
            )
        } catch (error) {
            if (request !== listingsRequestRef.current) return
            console.error("[ReservationDialog] Error loading listings:", error)
            setListings([])
        } finally {
            if (request === listingsRequestRef.current) setFlag("listings", false)
        }
    }, [setFlag])

    /** `true` si quedaron canales para elegir. */
    const loadSources = useCallback(async (): Promise<boolean> => {
        setFlag("sources", true)
        try {
            const data = (await catalogService.getReservationSources())
                .map((s) => ({ id: Number(s.id), name: s.name, code: (s as { code?: string }).code }))
                // El backend espera el id numérico: uno que no lo sea no se ofrece.
                .filter((s) => Number.isInteger(s.id) && s.id > 0)
            if (data.length === 0) throw new Error("catálogo de canales sin ids válidos")
            setSources(data)
            setSourcesFailed(false)
            return true
        } catch (error) {
            // Sin respaldo inventado: antes caía a 14/15/16, que no son los ids
            // reales, y la reserva quedaba en otro canal sin aviso.
            console.error("[ReservationDialog] Error loading sources:", error)
            setSources([])
            setSourcesFailed(true)
            return false
        } finally {
            setFlag("sources", false)
        }
    }, [setFlag])

    const loadCountries = useCallback(async () => {
        setFlag("countries", true)
        try {
            setCountries((await catalogService.getCountries()) as CountryOption[])
            setFailure("countries", false)
        } catch (error) {
            console.error("[ReservationDialog] Error loading countries:", error)
            setFailure("countries", true)
        } finally {
            setFlag("countries", false)
        }
    }, [setFlag, setFailure])

    const loadCurrencies = useCallback(async () => {
        setFlag("currencies", true)
        try {
            setCurrencies((await catalogService.getCurrencies()) as CurrencyOption[])
            setFailure("currencies", false)
        } catch (error) {
            console.error("[ReservationDialog] Error loading currencies:", error)
            setFailure("currencies", true)
        } finally {
            setFlag("currencies", false)
        }
    }, [setFlag, setFailure])

    const loadAll = useCallback(() => {
        void loadProperties()
        void loadSources()
        void loadCountries()
        void loadCurrencies()
    }, [loadProperties, loadSources, loadCountries, loadCurrencies])

    return {
        properties, listings, sources, countries, currencies,
        loading, sourcesFailed, failed,
        loadProperties, loadListings, loadSources, loadCountries, loadCurrencies, loadAll,
    }
}
