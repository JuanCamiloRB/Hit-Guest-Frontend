import { useSyncExternalStore } from "react"

/**
 * `true` solo después de hidratar. La sesión vive en un store de cliente
 * (persistido en `localStorage`), así que el servidor no la conoce y pintarla
 * en el primer render rompería la hidratación.
 *
 * `useSyncExternalStore` da las dos instantáneas que React ya tiene previstas:
 * `false` en el servidor, `true` en el cliente — sin el setState-en-efecto de
 * `useState(false)` + `useEffect` que marcaba `react-hooks/set-state-in-effect`.
 */
const neverResubscribe = () => () => {}

export function useHasHydrated(): boolean {
    return useSyncExternalStore(
        neverResubscribe,
        () => true,
        () => false,
    )
}
