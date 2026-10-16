"use client"

import { useCallback, useEffect, useState } from "react"
import { automationService } from "../services/automation-service"
import {
    EMPTY_IDENTITY_CATALOG,
    resolveIdentityProviders,
    type IdentityProviderCatalog,
} from "../lib/identity-providers"

export type IdentityCatalogState =
    | { status: "loading"; catalog: IdentityProviderCatalog }
    | { status: "ready"; catalog: IdentityProviderCatalog }
    | { status: "error"; catalog: IdentityProviderCatalog }

/**
 * Una sola carga del catálogo para toda la sesión de la página: los dos
 * lugares donde se editan overrides abren el mismo formulario, y no tiene
 * sentido pedir `/providers` cada vez que se abre. Un fallo NO se guarda: el
 * siguiente intento (o «Reintentar») vuelve a pedirlo.
 */
let cached: Promise<IdentityProviderCatalog> | null = null

function loadCatalog(): Promise<IdentityProviderCatalog> {
    if (!cached) {
        // `Promise.resolve().then`: un fallo síncrono también termina en el catch,
        // nunca rompe el render de quien usa el hook.
        cached = Promise.resolve()
            .then(() => automationService.listProviders({ statusProviderId: 8 }))
            .then(resolveIdentityProviders)
            .catch((error) => {
                cached = null
                throw error
            })
    }
    return cached
}

/** Solo para tests: olvida la carga compartida. */
export function resetIdentityProviderCatalogCache(): void {
    cached = null
}

/**
 * Qué proveedor es Avanzada y cuál Esencial, desde `GET /providers` y por
 * `verification_type` — nunca por ids fijos (cambian entre ambientes). Si el
 * catálogo no carga, Avanzada y Esencial quedan deshabilitadas con Reintentar:
 * nunca se envía un id supuesto.
 */
/** `enabled: false` no pide nada (el formulario de un override que no es de identidad). */
export function useIdentityProviderCatalog(enabled = true): IdentityCatalogState & { retry: () => void } {
    const [state, setState] = useState<IdentityCatalogState>({ status: "loading", catalog: EMPTY_IDENTITY_CATALOG })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        if (!enabled) return
        let active = true
        loadCatalog()
            .then((catalog) => { if (active) setState({ status: "ready", catalog }) })
            .catch((error) => {
                console.error("[identity-catalog] no se pudo cargar el catálogo de proveedores:", error)
                if (active) setState({ status: "error", catalog: EMPTY_IDENTITY_CATALOG })
            })
        return () => { active = false }
    }, [attempt, enabled])

    const retry = useCallback(() => {
        setState({ status: "loading", catalog: EMPTY_IDENTITY_CATALOG })
        setAttempt((n) => n + 1)
    }, [])

    return { ...state, retry }
}
