import { createStaleCache } from "@/lib/stale-cache"
import { userService } from "../services/user-service"

/**
 * Los usuarios de la cuenta. Volver a Configuración → Equipo muestra la
 * última lista al instante mientras se refresca detrás.
 */
export const usersCache = createStaleCache(() => userService.getUsers())

/** Solo para tests. */
export function resetUsersCache(): void {
    usersCache.reset()
}
