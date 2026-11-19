"use client"

import { useCallback, useEffect, useState } from "react"
import { integrationsService } from "../services/integrations-service"
import type {
    Integration,
    KunasConfigurationPayload,
    KunasConnectPayload,
} from "../types"

interface UseKunasIntegration {
    /** Current integration, or null when the PM has none connected. */
    integration: Integration | null
    /** True during the initial fetch. */
    isLoading: boolean
    /** Non-404 fetch error (e.g. server error). 404 resolves to `integration: null`. */
    loadError: unknown | null
    /** True right after a successful connect — used to show the "syncing" hint. */
    justConnected: boolean
    refetch: () => void

    // Mutations. Each updates local state on success and RE-THROWS on failure so
    // the calling form can surface inline field errors (see extractFieldErrors).
    connect: (payload: KunasConnectPayload) => Promise<void>
    updateCredentials: (payload: KunasConfigurationPayload) => Promise<void>
    setActive: (active: boolean) => Promise<void>
    disconnect: () => Promise<void>
}

/**
 * Owns the Kunas integration resource and the operations on it. Keeps the local
 * `integration` in sync with each mutation's response so the UI never needs a
 * refetch after connect / toggle / update.
 */
export function useKunasIntegration(): UseKunasIntegration {
    const [integration, setIntegration] = useState<Integration | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<unknown | null>(null)
    const [justConnected, setJustConnected] = useState(false)

    // Cadena `.then()`: `react-hooks/set-state-in-effect` solo acepta setState
    // en callbacks. La primera carga arranca con `isLoading: true` desde el
    // estado inicial; los reintentos (`load`) lo marcan antes de pedir.
    const fetchIntegration = useCallback(() =>
        integrationsService
            .getKunas()
            .then((data) => {
                setIntegration(data)
                setLoadError(null)
            })
            .catch((err) => {
                setIntegration(null)
                setLoadError(err)
            })
            .finally(() => setIsLoading(false)), [])

    useEffect(() => {
        void fetchIntegration()
    }, [fetchIntegration])

    const load = useCallback(() => {
        setIsLoading(true)
        setLoadError(null)
        void fetchIntegration()
    }, [fetchIntegration])

    const connect = useCallback(async (payload: KunasConnectPayload) => {
        const result = await integrationsService.connect(payload)
        setJustConnected(true)
        // El 202 no trajo la integración: se pide. Si todavía no existe, el
        // panel dice que la conexión se está procesando.
        if (result) setIntegration(result)
        else load()
    }, [load])

    const updateCredentials = useCallback(
        async (payload: KunasConfigurationPayload) => {
            const result = await integrationsService.updateConfiguration(payload)
            // Una respuesta sin la integración: se conserva lo que se veía y se relee.
            if (!result) return load()
            // Guardar credenciales SIEMPRE levanta la pausa (nota 2026-11-11 §5):
            // si la respuesta no trae el campo, la pausa ya no aplica.
            setIntegration({ ...result, credentialsStatus: result.credentialsStatus ?? null })
        },
        [load],
    )

    const setActive = useCallback(
        async (active: boolean) => {
            if (!integration) return
            const result = active
                ? await integrationsService.activate(integration.token)
                : await integrationsService.deactivate(integration.token)
            if (!result) return load()
            // Pausar o activar no levanta un rechazo de credenciales: si la
            // respuesta no trae el campo, se conserva el que ya se veía.
            setIntegration(result.credentialsStatus !== undefined
                ? result
                : { ...result, credentialsStatus: integration.credentialsStatus })
        },
        [integration, load],
    )

    const disconnect = useCallback(async () => {
        if (!integration) return
        await integrationsService.disconnect(integration.token)
        setIntegration(null)
        setJustConnected(false)
    }, [integration])

    return {
        integration,
        isLoading,
        loadError,
        justConnected,
        refetch: load,
        connect,
        updateCredentials,
        setActive,
        disconnect,
    }
}
