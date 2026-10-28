"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { InactiveResourceError } from "@/lib/inactive-resource"
import { LISTING_INACTIVE_EVENT } from "../lib/listing-inactive-signal"
import { PortalStatusScreen } from "./PortalStatusScreen"

/**
 * Cuando una acción del portal responde 422 `LISTING_INACTIVE` o
 * `PROPERTY_INACTIVE`, deja de mostrar la pantalla en curso y muestra la misma
 * de `portalStatus: "listing_inactive"`, con el mensaje del backend. Desmontar
 * la pantalla corta su flujo y evita que su `catch` pinte además un error
 * genérico. No se recupera sola: lo resuelve el anfitrión, y recargar vuelve a
 * preguntarle al backend.
 */
export function ListingInactiveBoundary({ children }: { children: ReactNode }) {
    const [inactive, setInactive] = useState<InactiveResourceError | null>(null)

    useEffect(() => {
        const onInactive = (event: Event) => setInactive((event as CustomEvent<InactiveResourceError>).detail)
        window.addEventListener(LISTING_INACTIVE_EVENT, onInactive)
        return () => window.removeEventListener(LISTING_INACTIVE_EVENT, onInactive)
    }, [])

    if (inactive) return <PortalStatusScreen status="listing_inactive" message={inactive.message} />
    return <>{children}</>
}
