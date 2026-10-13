export function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?"
}

/** «10 oct 2026»; `null` sin fecha válida. */
export function shortDate(iso: string | null): string | null {
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
}

const ROLE_LABELS: Record<string, string> = {
    property_manager: "Administrador",
    property_staff: "Staff de apoyo",
    read_only: "Solo lectura",
}

/** Rol del usuario (`role` del contrato). Uno desconocido se muestra tal cual. */
export function roleLabel(role: string | null): string | null {
    return role ? (ROLE_LABELS[role] ?? role) : null
}
