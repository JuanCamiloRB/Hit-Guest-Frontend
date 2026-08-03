"use client"

import { useCallback, useEffect, useState } from "react"
import { bffFetch } from "@/lib/bff-client"
import type { Property, Unit } from "@/types"
import { apiResponseToFormData } from "../types"

/** A listing plus the raw API fields the listings table reads (lock id, locale…). */
export interface PortfolioListing extends Unit {
    /** Lock identifier configured for this listing, when the PM set one. */
    lockId: string | null
}

interface Portfolio {
    properties: Property[]
    listings: PortfolioListing[]
    isLoading: boolean
    /** Drops the cache and re-fetches (after creating/editing a property). */
    refresh: () => void
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AggregatedResponse = { properties: any[]; listings: any[] }

// The whole portfolio comes from one aggregated BFF call. Cached at module level
// so the Tablero header and the Propiedades page share a single network pass, and
// de-duped while in flight so concurrent mounts don't each fire a request.
let cache: { properties: Property[]; listings: PortfolioListing[] } | null = null
let inflight: Promise<{ properties: Property[]; listings: PortfolioListing[] }> | null = null

function readExtra(raw: any): Record<string, any> {
    return raw.extra ?? {}
}

function toProperty(raw: any, index: number): Property {
    const formData = apiResponseToFormData(raw)
    const extra = readExtra(raw)
    const isActive = formData.statusRecordId === 1 || formData.statusRecordId === 6

    return {
        id: raw.uuid || String(index + 1),
        uuid: raw.uuid,
        name: formData.name,
        description: formData.description || "",
        email: formData.email,
        phone: formData.phone,
        address: {
            line1: formData.address,
            city: formData.city,
            country: "Colombia",
        },
        address_detail: formData.addressDetail,
        city: formData.city,
        state: formData.state,
        country_id: formData.countryId,
        geo_location:
            formData.latitude && formData.longitude
                ? `${formData.latitude},${formData.longitude}`
                : null,
        timezone: formData.timezone,
        status_record_id: formData.statusRecordId,
        status: isActive ? "ACTIVE" : "INACTIVE",
        type: String(
            raw.propertyTypeId ||
                raw.property_type_id ||
                formData.propertyTypeId ||
                extra.propertyTypeId ||
                extra.type ||
                "102",
        ),
        thumbnailUrl: formData.thumbnailUrl,
        created_at: raw.createdAt,
        updated_at: raw.updatedAt,
        extra: {
            ...extra,
            propertyTypeId: formData.propertyTypeId,
            type: extra.type || (formData.propertyTypeId === 101 ? "HOTEL" : "BUILDING"),
            thumbnailUrl: formData.thumbnailUrl,
        },
    } as unknown as Property
}

function toListing(raw: any, index: number): PortfolioListing {
    const extra = readExtra(raw)
    const price = Number(
        raw.price || raw.start_price || raw.startPrice || raw.total_price || extra.startPrice || 0,
    )
    const statusId = raw.statusRecordId ?? raw.status_record_id ?? raw.statusRecord?.id
    const isActive = statusId === 1 || statusId === 6
    const lockId = extra.lockId ?? extra.lock_id ?? extra.ttlockId ?? raw.lockId

    return {
        id: raw.uuid || String(index + 1),
        uuid: raw.uuid,
        propertyId:
            raw._propertyUuid || raw.propertyUuid || raw.property_uuid || raw.property_id || "",
        name: raw.name ?? "",
        number: raw.internalName || raw.internal_name || "",
        type: "ENTIRE_PLACE",
        capacity: Number(extra.maxOccupancy ?? extra.max_occupancy ?? raw.maxOccupancy ?? 2),
        amenities: [],
        pricePerNight: price,
        status: isActive ? "ACTIVE" : "INACTIVE",
        inheritWifi: false,
        lockId: lockId ? String(lockId) : null,
    }
}

function load(): Promise<{ properties: Property[]; listings: PortfolioListing[] }> {
    if (cache) return Promise.resolve(cache)
    if (!inflight) {
        inflight = bffFetch<AggregatedResponse>("/api/bff/properties-with-listings")
            .then((res) => {
                const result = {
                    properties: (res.properties || []).map(toProperty),
                    listings: (res.listings || []).map(toListing),
                }
                cache = result
                return result
            })
            .finally(() => {
                inflight = null
            })
    }
    return inflight
}

/**
 * The account's properties and their listings, from the single aggregated BFF
 * endpoint. Both the Tablero (portfolio counts in the header) and the Propiedades
 * page read from here, so they never disagree and never fetch twice.
 */
export function usePortfolio(): Portfolio {
    const [properties, setProperties] = useState<Property[]>(cache?.properties ?? [])
    const [listings, setListings] = useState<PortfolioListing[]>(cache?.listings ?? [])
    const [isLoading, setIsLoading] = useState(!cache)

    const fetchPortfolio = useCallback((mountedRef: { current: boolean }) => {
        setIsLoading(true)
        load()
            .then((res) => {
                if (!mountedRef.current) return
                setProperties(res.properties)
                setListings(res.listings)
            })
            .catch((error) => {
                console.error("[usePortfolio] Error fetching portfolio:", error)
                if (!mountedRef.current) return
                setProperties([])
                setListings([])
            })
            .finally(() => {
                if (mountedRef.current) setIsLoading(false)
            })
    }, [])

    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        const mountedRef = { current: true }
        fetchPortfolio(mountedRef)
        return () => {
            mountedRef.current = false
        }
    }, [fetchPortfolio, reloadKey])

    const refresh = useCallback(() => {
        cache = null
        setReloadKey((k) => k + 1)
    }, [])

    return { properties, listings, isLoading, refresh }
}
