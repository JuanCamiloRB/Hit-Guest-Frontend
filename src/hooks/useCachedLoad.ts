"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { StaleCache } from "@/lib/stale-cache"

/**
 * - `loading`: primera carga, sin valor todavía.
 * - `refreshing`: hay valor y se está actualizando.
 * - `ready`: al día.
 * - `error`: no hay valor y la carga falló (o agotó los reintentos).
 */
export type LoadStatus = "loading" | "refreshing" | "ready" | "error"

/**
 * Deben ser ESTABLES (una constante de módulo): son dependencias del efecto
 * de carga, y una función nueva en cada render volvería a cargar cada vez.
 */
export interface CachedLoadOptions {
    /** Un fallo que se reintenta solo (p. ej. un 202 de «todavía no»). */
    isRetryable?: (error: unknown) => boolean
    retries?: number
    /** Espera entre reintentos; 0 = enseguida. */
    retryMs?: number
    /** Eventos de `window` que piden un refresco conservando lo que se ve. */
    refreshOn?: readonly string[]
}

export interface CachedLoadState<T> {
    /** `null` mientras no hay valor; después, el último bueno. */
    data: T | null
    status: LoadStatus
    /** El último fallo fue reintentable y se está (o se estuvo) reintentando. */
    retrying: boolean
    /** Había valor, la actualización falló y se sigue mostrando el anterior. */
    refreshFailed: boolean
    /** Mensaje del último fallo no reintentable, para quien quiera mostrarlo. */
    errorMessage: string | null
    /** Sube con cada valor que llega del servidor (no con `patch`). */
    version: number
    /** Vuelve a pedir conservando lo que se ve. */
    refresh: () => void
}

type Run = (mode: "load" | "refresh", attempt?: number) => Promise<void>

const serverSnapshot = () => null

/**
 * Estado de pantalla sobre una `StaleCache`: un fallo nunca borra lo ya
 * cargado y solo la carga más reciente escribe el estado (una anterior que
 * termine después, cuyo valor la caché ya descartó, no puede dejar la
 * pantalla «sin datos y sin carga», que se vería como un error).
 *
 * Sin UI: cada pantalla decide qué decir con `retrying`, `refreshFailed` o
 * `errorMessage`. Los oyentes de `refreshOn` son por instancia: con dos
 * pantallas montadas a la vez sobre la misma caché, cada evento pediría dos
 * refrescos (hoy no pasa: una pantalla por ruta).
 */
export function useCachedLoad<T>(cache: StaleCache<T>, options: CachedLoadOptions = {}): CachedLoadState<T> {
    const { isRetryable, retries = 0, retryMs = 0, refreshOn = [] } = options
    const data = useSyncExternalStore(cache.subscribe, cache.read, serverSnapshot)
    // Arranca en true: la primera carga sale del efecto de montaje.
    const [inFlight, setInFlight] = useState(true)
    const [issue, setIssue] = useState<{ kind: "error"; message: string } | { kind: "retrying" } | null>(null)
    const [version, setVersion] = useState(0)
    // Otra caché (otro uuid) arranca limpia en el mismo render: sin esto habría
    // un frame «sin datos y sin carga» (error) y heredaría el fallo anterior.
    const [seen, setSeen] = useState(cache)
    if (seen !== cache) {
        setSeen(cache)
        setInFlight(true)
        setIssue(null)
    }
    // La carga vive en el efecto (con sus variables locales); `refresh` y los
    // oyentes la alcanzan por esta ref, que solo se escribe ahí.
    const runRef = useRef<Run | null>(null)

    useEffect(() => {
        let cancelled = false
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let latest = 0

        const run: Run = async (mode, attempt = 0) => {
            if (cancelled) return
            // Un refresco manual durante la espera de un reintento lo reemplaza.
            if (retryTimer) {
                clearTimeout(retryTimer)
                retryTimer = null
            }
            const id = ++latest
            setInFlight(true)
            let retryScheduled = false
            try {
                await (mode === "refresh" ? cache.refresh() : cache.load())
                if (cancelled || id !== latest) return
                setIssue(null)
                setVersion((v) => v + 1)
            } catch (error) {
                if (cancelled || id !== latest) return
                if (isRetryable?.(error)) {
                    setIssue({ kind: "retrying" })
                    if (attempt < retries) {
                        retryScheduled = true
                        retryTimer = setTimeout(() => void run("refresh", attempt + 1), retryMs)
                    }
                } else {
                    console.error("[useCachedLoad] no se pudo cargar:", error)
                    setIssue({ kind: "error", message: error instanceof Error ? error.message : String(error) })
                }
            } finally {
                if (!cancelled && id === latest && !retryScheduled) setInFlight(false)
            }
        }
        runRef.current = run
        void run("load")
        return () => {
            cancelled = true
            runRef.current = null
            if (retryTimer) clearTimeout(retryTimer)
        }
    }, [cache, isRetryable, retries, retryMs])

    // Los oyentes van aparte: cambiar qué eventos se escuchan no vuelve a cargar.
    const eventsKey = refreshOn.join("|")
    useEffect(() => {
        if (!eventsKey) return
        const onEvent = () => void runRef.current?.("refresh")
        const events = eventsKey.split("|")
        events.forEach((name) => window.addEventListener(name, onEvent))
        return () => events.forEach((name) => window.removeEventListener(name, onEvent))
    }, [eventsKey])

    const refresh = useCallback(() => {
        void runRef.current?.("refresh")
    }, [])

    const status: LoadStatus = data === null
        ? inFlight ? "loading" : "error"
        : inFlight ? "refreshing" : "ready"

    return {
        data,
        status,
        retrying: issue?.kind === "retrying",
        refreshFailed: data !== null && issue?.kind === "error" && !inFlight,
        errorMessage: issue?.kind === "error" ? issue.message : null,
        version,
        refresh,
    }
}
