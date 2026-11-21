import { FileSignature, FileText, KeyRound, Landmark, Link2, LogIn, LogOut, Users, type LucideIcon } from "lucide-react"

/**
 * El ícono de cada automatización, UNO por cosa en toda la app (estándar de
 * tablas, plan 20261120): el encabezado y la celda de Operaciones, las columnas
 * de consumo del Tablero y cualquier tabla nueva toman el mismo. Antes el
 * Tablero no tenía íconos y Operaciones tenía los suyos sueltos en la feature.
 */
export const AUTOMATION_ICONS = {
    /** Envío del link de check-in. */
    link: Link2,
    /** Check-in de huéspedes con verificación de identidad. */
    identity: Users,
    /** Firma del contrato. */
    contract: FileSignature,
    /** Código de acceso (cerradura). */
    access: KeyRound,
    /** Reporte TRA. */
    tra: Landmark,
    /** SIRE: el reporte de entrada; la salida tiene el suyo. */
    sire: LogIn,
    sireOut: LogOut,
    /** Reporte PDF. */
    pdf: FileText,
} as const satisfies Record<string, LucideIcon>
