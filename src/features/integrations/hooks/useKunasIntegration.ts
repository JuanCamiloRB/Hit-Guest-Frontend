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

    const load = useCallback(() => {
        setIsLoading(true)
        setLoadError(null)
        integrationsService
            .getKunas()
            .then((data) => setIntegration(data))
            .catch((err) => {
                setIntegration(null)
                setLoadError(err)
            })
            .finally(() => setIsLoading(false))
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const connect = useCallback(async (payload: KunasConnectPayload) => {
        const result = await integrationsService.connect(payload)
        setIntegration(result)
        setJustConnected(true)
    }, [])

    const updateCredentials = useCallback(
        async (payload: KunasConfigurationPayload) => {
            const result = await integrationsService.updateConfiguration(payload)
            setIntegration(result)
        },
        [],
    )

    const setActive = useCallback(
        async (active: boolean) => {
            if (!integration) return
            const result = active
                ? await integrationsService.activate(integration.id)
                : await integrationsService.deactivate(integration.id)
            setIntegration(result)
        },
        [integration],
    )

    const disconnect = useCallback(async () => {
        if (!integration) return
        await integrationsService.disconnect(integration.id)
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
