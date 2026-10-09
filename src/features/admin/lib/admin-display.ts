import type { StatusTone } from "@/components/ui/status-pill"

/** Estado de un cliente o usuario. Un valor desconocido se muestra tal cual, en tono neutro. */
export function accountStatusMeta(status: string | null): { label: string; tone: StatusTone } | null {
    if (!status) return null
    switch (status.toLowerCase()) {
        case "active":
            return { label: "Activo", tone: "success" }
        case "suspended":
            return { label: "Suspendido", tone: "warning" }
        case "inactive":
        case "deleted":
            return { label: "Inactivo", tone: "idle" }
        default:
            return { label: status, tone: "idle" }
    }
}

export function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?"
}

/** «jul 2026»; `null` sin fecha válida. */
export function monthYear(iso: string | null): string | null {
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString("es-CO", { month: "short", year: "numeric" })
}

/** «9 oct, 08:12»; `null` sin fecha válida. */
export function dateTime(iso: string | null): string | null {
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

const ROLE_LABELS: Record<string, string> = {
    property_manager: "Property manager",
    property_staff: "Staff",
    read_only: "Solo lectura",
    super_admin: "Superusuario",
}

export function roleLabel(roles: string[]): string | null {
    const first = roles[0]
    return first ? (ROLE_LABELS[first] ?? first) : null
}
