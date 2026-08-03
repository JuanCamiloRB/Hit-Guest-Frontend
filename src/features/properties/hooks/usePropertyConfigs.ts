"use client"

import { useEffect, useState } from "react"
import { automationService, canonicalSlug } from "../services/automation-service"
import type { PropertyAutomation } from "../types/automation"

/** What a property's active automations add up to, as shown on its card. */
export interface PropertyConfig {
    /** Active automations on the property — what each listing inherits. */
    activeCount: number
    /** Identity-verification tier, from the provider the PM chose. */
    verification: "advanced" | "essential" | null
    /** Digital-signature provider label, when a contract automation is active. */
    contract: string | null
    /** Colombian tourism registry (TRA) reporting is on. */
    tra: boolean
    /** Colombian migration (SIRE) reporting is on. */
    sire: boolean
    /** Smart-lock provider label (e.g. "TTLOCK"), or null when there's no lock. */
    lock: string | null
}

export const EMPTY_CONFIG: PropertyConfig = {
    activeCount: 0,
    verification: null,
    contract: null,
    tra: false,
    sire: false,
    lock: null,
}

/**
 * Biometric providers verify a live face against the document; OCR providers only
 * read the document. The card surfaces that difference as the verification tier.
 */
const BIOMETRIC_RE = /didit|veriff|sumsub|metamap|jumio/

function contractLabel(slug: string): string {
    if (slug.includes("tufirma")) return "TuFirma"
    return "Firma digital"
}

/** Folds one property's automations into the badge-level summary. */
function summarize(automations: PropertyAutomation[]): PropertyConfig {
    const config: PropertyConfig = { ...EMPTY_CONFIG }

    for (const automation of automations) {
        if (!automation.isActive) continue
        config.activeCount += 1

        const slug = canonicalSlug(automation.providerName)
        if (slug.includes("ttlock") || slug.includes("lock")) {
            config.lock = "TTLOCK"
        } else if (slug.includes("tra")) {
            config.tra = true
        } else if (slug.includes("sire")) {
            config.sire = true
        } else if (slug.includes("firma") || slug.includes("contract")) {
            config.contract = contractLabel(slug)
        } else if (BIOMETRIC_RE.test(slug)) {
            // Biometric wins: if any guest type is verified biometrically the
            // property is running the advanced tier.
            config.verification = "advanced"
        } else if (slug.includes("textract") || slug.includes("ocr")) {
            config.verification ??= "essential"
        }
    }

    return config
}

/**
 * Automation configuration per property UUID, from a single account-wide call to
 * `GET /property-automations`. Feeds the configuration badges on the property
 * cards and the "automatizaciones" column of the listings table — a listing
 * inherits its property's configuration unless it overrides it.
 */
export function usePropertyConfigs(): {
    configs: Map<string, PropertyConfig>
    isLoading: boolean
} {
    const [configs, setConfigs] = useState<Map<string, PropertyConfig>>(new Map())
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        automationService
            .listGlobal({ includeProvider: true })
            .then((automations) => {
                if (!mounted) return
                const byProperty = new Map<string, PropertyAutomation[]>()
                for (const automation of automations) {
                    const key = automation.propertyUuid
                    if (!key) continue
                    byProperty.set(key, [...(byProperty.get(key) ?? []), automation])
                }
                setConfigs(
                    new Map([...byProperty].map(([uuid, list]) => [uuid, summarize(list)])),
                )
            })
            .catch((error) => {
                console.error("[usePropertyConfigs] Error fetching automations:", error)
                if (mounted) setConfigs(new Map())
            })
            .finally(() => {
                if (mounted) setIsLoading(false)
            })

        return () => {
            mounted = false
        }
    }, [])

    return { configs, isLoading }
}
