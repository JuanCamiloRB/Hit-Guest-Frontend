import { useCallback, useSyncExternalStore } from "react"

/**
 * `true` cuando la ventana cumple la consulta (`(max-width: 767px)`). En el
 * servidor y durante la hidratación es `false`: la primera pintura es la de
 * escritorio y se ajusta al hidratar, sin `setState` en un efecto.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback((onChange: () => void) => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
        const mq = window.matchMedia(query)
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [query])
    return useSyncExternalStore(
        subscribe,
        () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
        () => false,
    )
}

/** Por debajo de `md` (768 px): la fila apilada de `DataTable`, el calendario de un mes. */
export const SMALL_SCREEN_QUERY = "(max-width: 767px)"
