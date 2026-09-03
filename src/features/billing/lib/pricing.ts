/**
 * Pricing helpers — maps automation usage records to the dashboard's cost
 * categories and formats USD amounts.
 *
 * We classify by the record's providerSlug (canonicalised) first, then fall back
 * to the automation name, because identity-verification providers vary
 * (didit / veriff / sumsub…) while the other categories have stable slugs.
 */

import { canonicalSlug } from "@/features/properties/services/automation-service"
import type { CostCategory } from "../types"

/** Display metadata for each cost category, in the order shown on the table. */
export const COST_CATEGORIES: { key: CostCategory; label: string }[] = [
    { key: "checkin", label: "Verificación" },
    { key: "contract", label: "Contrato" },
    { key: "tra", label: "TRA" },
    { key: "sire", label: "SIRE" },
    { key: "access", label: "Accesos" },
]

const CHECKIN_NAME_RE = /identity|verificaci[oó]n|check-?in|didit|veriff|sumsub|metamap|jumio/i

/**
 * Classify a usage record into a cost category, or null if it isn't one of the
 * billable buckets we surface (e.g. the check-in link, PDF report).
 */
export function classifyRecord(
    providerSlug: string | null | undefined,
    automationName?: string | null,
): CostCategory | null {
    const s = canonicalSlug(providerSlug)
    const name = automationName ?? ""

    // Identidad PRIMERO: "textract" contiene "tra", así que el orden anterior
    // clasificaba la verificación esencial en la columna TRA.
    if (s.includes("textract") || CHECKIN_NAME_RE.test(s) || CHECKIN_NAME_RE.test(name)) {
        return "checkin"
    }
    // "signature" incluido: la firma nativa es `hitguest_signature` y no contiene
    // ni "firma" ni "contract" — sus ejecuciones (gratuitas) no clasificaban.
    if (/tufirma|firma|signature|contract/.test(s) || /signature|contract|contrato/i.test(name)) {
        return "contract"
    }
    if (s.includes("ttlock") || s.includes("lock") || s.includes("access")) return "access"
    // Con borde: el substring pelado también matchea "registra", "extra"…
    if (/(^|_)tra(_|$)/.test(s)) return "tra"
    if (s.includes("sire")) return "sire"

    return null
}
