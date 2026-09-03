import { canonicalSlug } from "../services/automation-service"
import { IDENTITY_PROVIDER_SLUGS, providerLabel } from "./provider-labels"
import { CONTRACT_TYPE_LABELS, summarizeContractRouting } from "../types/contract-routing"

/**
 * Fila mínima que necesita la derivación — es lo que el BFF agregado devuelve
 * tras sanitizar la respuesta de `GET /properties/{uuid}/automations`
 * (`providerSlug` es la señal estable que el backend agregó el 2026-08-12;
 * el objeto `provider` sideloaded se descarta en el BFF porque serializa
 * credenciales).
 */
export interface PropertyAutomationOverviewRow {
    providerSlug: string | null
    statusProviderId: number
    /** Solo la fila de firma lo trae, y solo con las claves de routing. */
    parameters?: Record<string, unknown> | null
}

export type PropertyBadgeKind = "identity" | "contract" | "ops" | "absent"

export interface PropertyBadge {
    key: string
    label: string
    kind: PropertyBadgeKind
}

const ACTIVE_STATUS = 8

/**
 * Etiquetas cortas por slug. Presentación pura: el backend dice QUÉ hay
 * encendido y esto decide cómo nombrarlo en una insignia.
 *
 * Las de identidad NO se escriben acá: salen de `provider-labels.ts`, que las
 * deriva de `automation-definitions.ts`. Estaban copiadas a mano y el comentario
 * decía que "reusaban" ese naming — copiar no es reusar, y es así como una
 * pantalla se queda con el nombre viejo después de un rename.
 */
const OPS_LABELS: Record<string, string> = {
    tra_colombia: "TRA",
    sire_colombia: "SIRE",
    ttlock: "TTLock",
    pdf_report: "Reporte PDF",
}

const SIGNATURE_SLUGS = new Set(["tufirma", "hitguest_signature"])

/**
 * Insignias de una propiedad a partir de sus filas de automatización.
 *
 * Reglas:
 * - Solo cuenta lo ENCENDIDO (`statusProviderId === 8`). Encendida ≠ corriendo:
 *   el despachador tiene once gates silenciosos, así que la insignia afirma
 *   configuración, nunca ejecución.
 * - La firma se etiqueta por lo que se firma (`parameters.by_source` →
 *   `CONTRACT_TYPE_LABELS`), una insignia por tipo distinto entre canales. Sin
 *   routing legible, la insignia es "Contrato" a secas — no se inventa el tipo.
 * - Un slug activo desconocido se muestra con su slug canónico: una fila que el
 *   backend sí tiene nunca se oculta.
 * - `rows === null` significa "no sabemos" (fetch caído): no se deriva nada,
 *   tampoco la ausencia de cerradura — ausencia afirmada ≠ dato faltante.
 * - "Sin cerradura" solo se afirma con datos en la mano y sin TTLock activo.
 */
export function derivePropertyBadges(rows: PropertyAutomationOverviewRow[] | null): PropertyBadge[] | null {
    if (rows === null) return null

    const badges: PropertyBadge[] = []
    const seen = new Set<string>()
    const push = (badge: PropertyBadge) => {
        if (seen.has(badge.label)) return
        seen.add(badge.label)
        badges.push(badge)
    }

    let hasLock = false
    for (const row of rows) {
        if (row.statusProviderId !== ACTIVE_STATUS) continue
        const slug = canonicalSlug(row.providerSlug)
        if (!slug) continue

        if (IDENTITY_PROVIDER_SLUGS.has(slug)) {
            push({ key: `identity:${slug}`, label: providerLabel(slug) ?? slug, kind: "identity" })
            continue
        }

        if (SIGNATURE_SLUGS.has(slug)) {
            const routing = summarizeContractRouting(row.parameters ?? undefined)
            if (!routing) {
                push({ key: "contract", label: "Contrato", kind: "contract" })
                continue
            }
            for (const channel of routing.channels) {
                push({
                    key: `contract:${channel.contractType}`,
                    label: CONTRACT_TYPE_LABELS[channel.contractType],
                    kind: "contract",
                })
            }
            continue
        }

        if (slug === "ttlock") hasLock = true
        push({ key: `ops:${slug}`, label: OPS_LABELS[slug] ?? slug, kind: "ops" })
    }

    if (!hasLock) {
        push({ key: "absent:ttlock", label: "Sin cerradura", kind: "absent" })
    }

    return badges
}
