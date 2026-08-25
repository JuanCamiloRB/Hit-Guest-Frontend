"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    formatSuggestion,
    mergeTypedAddress,
    type GeocodePlaceDetails,
} from "@/lib/geocoding/address"

export type PlaceDetails = GeocodePlaceDetails

interface Suggestion {
    placeId: string
    description: string
    details?: PlaceDetails
}

interface AddressAutocompleteProps {
    value: string
    onChange: (value: string) => void
    /** Fired when the user picks a suggestion and its details resolve. */
    onSelect: (details: PlaceDetails) => void
    placeholder?: string
    className?: string
}

type UnavailableReason = "manual_search_required" | "provider_error" | null

/** A short opaque token grouping keystrokes + the details call into one billed session. */
function newSessionToken(): string {
    return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

/**
 * Google Places address autocomplete. The key lives server-side; this talks only
 * to our /api/geocode proxy. Debounces input, shows a suggestions dropdown, and on
 * selection resolves the place's coordinates + address parts via onSelect.
 */
export function AddressAutocomplete({
    value,
    onChange,
    onSelect,
    placeholder,
    className,
}: AddressAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [resolving, setResolving] = useState(false)
    // El buscador de direcciones no está configurado en este entorno. Se muestra
    // para que el usuario sepa que tiene que colocar el pin a mano, en vez de
    // pelearse con un campo que no responde.
    const [unavailable, setUnavailable] = useState(false)
    const [unavailableReason, setUnavailableReason] = useState<UnavailableReason>(null)
    const [noResults, setNoResults] = useState(false)
    const [manualSearchAvailable, setManualSearchAvailable] = useState(false)
    const sessionRef = useRef<string>(newSessionToken())
    const containerRef = useRef<HTMLDivElement>(null)
    // Suppress the fetch that would fire right after a selection sets `value`.
    const skipNextFetch = useRef(false)
    // Details can resolve after the PM has resumed typing. Only the most recent
    // selection is allowed to update the form.
    const selectionVersionRef = useRef(0)

    // Debounced autocomplete fetch on value change. All setState runs inside the
    // timeout callback (async) — never synchronously in the effect body, per
    // react-hooks/set-state-in-effect.
    useEffect(() => {
        if (skipNextFetch.current) {
            skipNextFetch.current = false
            return
        }
        const q = value.trim()
        let active = true
        const t = setTimeout(async () => {
            if (q.length < 3) {
                if (active) {
                    setSuggestions([])
                    setOpen(false)
                    setLoading(false)
                    setUnavailable(false)
                    setUnavailableReason(null)
                    setNoResults(false)
                    setManualSearchAvailable(false)
                }
                return
            }
            if (active) {
                setLoading(true)
                setNoResults(false)
            }
            try {
                const res = await fetch(
                    `/api/geocode/autocomplete?q=${encodeURIComponent(q)}&session=${sessionRef.current}`,
                )
                const data = await res.json()
                if (!active) return
                setUnavailable(data?.unavailable === true)
                setUnavailableReason(data?.reason ?? null)
                setManualSearchAvailable(data?.manualSearchAvailable === true)
                const nextSuggestions: Suggestion[] = Array.isArray(data?.suggestions)
                    ? data.suggestions
                    : []
                setSuggestions(nextSuggestions)
                setOpen(nextSuggestions.length > 0)
                setNoResults(data?.unavailable !== true && nextSuggestions.length === 0)
            } catch {
                if (active) {
                    setSuggestions([])
                    setUnavailable(true)
                    setUnavailableReason("provider_error")
                    setNoResults(false)
                    setManualSearchAvailable(false)
                }
            } finally {
                if (active) setLoading(false)
            }
        }, 300)
        return () => { active = false; clearTimeout(t) }
    }, [value])

    // Close on outside click.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", onClick)
        return () => document.removeEventListener("mousedown", onClick)
    }, [])

    const handleInputChange = (nextValue: string) => {
        selectionVersionRef.current += 1
        onChange(nextValue)
    }

    const handleManualSearch = async () => {
        const q = value.trim()
        if (q.length < 3 || loading || resolving) return

        setLoading(true)
        setUnavailable(false)
        setUnavailableReason(null)
        setNoResults(false)
        try {
            const res = await fetch(
                `/api/geocode/autocomplete?q=${encodeURIComponent(q)}&session=${sessionRef.current}&mode=search`,
            )
            const data = await res.json()
            const nextSuggestions: Suggestion[] = Array.isArray(data?.suggestions)
                ? data.suggestions
                : []
            setSuggestions(nextSuggestions)
            setOpen(nextSuggestions.length > 0)
            setUnavailable(data?.unavailable === true)
            setUnavailableReason(data?.reason ?? null)
            setNoResults(data?.unavailable !== true && nextSuggestions.length === 0)
        } catch {
            setSuggestions([])
            setUnavailable(true)
            setUnavailableReason("provider_error")
        } finally {
            setLoading(false)
        }
    }

    const handlePick = async (s: Suggestion) => {
        const typedValue = value
        const selectionVersion = ++selectionVersionRef.current
        setOpen(false)
        setSuggestions([])
        setResolving(true)
        try {
            if (s.details) {
                const details = mergeTypedAddress(s.details, typedValue)
                skipNextFetch.current = true
                onChange(details.addressLine1 || details.formattedAddress || s.description)
                onSelect(details)
                return
            }
            const res = await fetch(
                `/api/geocode/details?placeId=${encodeURIComponent(s.placeId)}&session=${sessionRef.current}`,
            )
            if (res.ok) {
                const providerDetails: PlaceDetails = await res.json()
                if (selectionVersion !== selectionVersionRef.current) return
                const details = mergeTypedAddress(providerDetails, typedValue)
                skipNextFetch.current = true
                onChange(details.addressLine1 || details.formattedAddress || s.description)
                onSelect(details)
            } else if (selectionVersion === selectionVersionRef.current) {
                skipNextFetch.current = true
                onChange(formatSuggestion(s.description, typedValue))
            }
        } catch {
            if (selectionVersion === selectionVersionRef.current) {
                skipNextFetch.current = true
                onChange(formatSuggestion(s.description, typedValue))
            }
        } finally {
            setResolving(false)
            if (selectionVersion === selectionVersionRef.current) {
                // A new session starts after each completed selection.
                sessionRef.current = newSessionToken()
            }
        }
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && manualSearchAvailable) {
                            event.preventDefault()
                            void handleManualSearch()
                        }
                    }}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    autoComplete="off"
                    className={cn(
                        "w-full pl-9 pr-9 h-11 rounded-md border border-slate-200 bg-white text-sm",
                        "focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none",
                        className,
                    )}
                />
                {(loading || resolving) && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
            </div>

            {open && suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {suggestions.map((s) => (
                        <li key={s.placeId}>
                            <button
                                type="button"
                                onClick={() => handlePick(s)}
                                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-primary/10"
                            >
                                <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="line-clamp-2">
                                    {formatSuggestion(s.description, value)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/*
              * El buscador no está configurado en este entorno. Decirlo evita el
              * peor final posible: el usuario escribe la dirección, no aparece
              * ninguna sugerencia, y se va convencido de que quedó ubicada —
              * cuando en realidad la propiedad se guardó sin coordenadas.
              */}
            {unavailable && (
                <p className="mt-1.5 text-xs text-amber-700" role="status">
                    {unavailableReason === "manual_search_required"
                        ? "Completa la dirección y presiona Enter o Buscar dirección."
                        : "El buscador mundial de direcciones no está respondiendo. Intenta nuevamente o ubica la propiedad arrastrando el pin."}
                </p>
            )}
            {manualSearchAvailable && (
                <button
                    type="button"
                    onClick={() => void handleManualSearch()}
                    disabled={loading || resolving || value.trim().length < 3}
                    className="mt-2 inline-flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Buscar dirección
                </button>
            )}
            {noResults && !loading && (
                <p className="mt-1.5 text-xs text-slate-500" role="status">
                    No encontramos coincidencias. Agrega calle, ciudad o localidad y país; la unidad se conservará automáticamente.
                </p>
            )}
        </div>
    )
}
