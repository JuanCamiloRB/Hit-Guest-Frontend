"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PlaceDetails {
    lat: number | null
    lng: number | null
    formattedAddress: string
    city: string
    state: string
    /** ISO2 country code, e.g. "CO". */
    countryCode: string
}

interface Suggestion {
    placeId: string
    description: string
}

interface AddressAutocompleteProps {
    value: string
    onChange: (value: string) => void
    /** Fired when the user picks a suggestion and its details resolve. */
    onSelect: (details: PlaceDetails) => void
    placeholder?: string
    className?: string
}

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
    const sessionRef = useRef<string>(newSessionToken())
    const containerRef = useRef<HTMLDivElement>(null)
    // Suppress the fetch that would fire right after a selection sets `value`.
    const skipNextFetch = useRef(false)

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
                if (active) { setSuggestions([]); setOpen(false); setLoading(false) }
                return
            }
            if (active) setLoading(true)
            try {
                const res = await fetch(
                    `/api/geocode/autocomplete?q=${encodeURIComponent(q)}&session=${sessionRef.current}`,
                )
                const data = await res.json()
                if (!active) return
                setSuggestions(data?.suggestions ?? [])
                setOpen((data?.suggestions ?? []).length > 0)
            } catch {
                if (active) setSuggestions([])
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

    const handlePick = async (s: Suggestion) => {
        skipNextFetch.current = true
        onChange(s.description)
        setOpen(false)
        setSuggestions([])
        setResolving(true)
        try {
            const res = await fetch(
                `/api/geocode/details?placeId=${encodeURIComponent(s.placeId)}&session=${sessionRef.current}`,
            )
            if (res.ok) {
                const details: PlaceDetails = await res.json()
                onSelect(details)
            }
        } catch {
            // Non-fatal: the address text is already set; the user can still drag the pin.
        } finally {
            setResolving(false)
            // A new session starts after each completed selection.
            sessionRef.current = newSessionToken()
        }
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
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
                                <span className="line-clamp-2">{s.description}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
