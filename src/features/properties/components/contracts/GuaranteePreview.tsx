"use client"

import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { useLanguageStore } from "@/store/useLanguageStore"
import {
    systemDocumentService,
    resolveGuaranteePreview,
    GUARANTEE_DOCUMENT_SLUG,
    type SystemDocument,
} from "../../services/system-document-service"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { LoadingState } from "@/components/ui/loading-state"

/**
 * Read-only preview of the HitGuest-maintained damage/consumption guarantee
 * text (backend plan §2) — shown whenever the PM picks a `contract_type` that
 * includes the guarantee. Not editable here: only HitGuest staff can change
 * this text (§5, a separate internal tool this repo doesn't build).
 */
export function GuaranteePreview() {
    const language = useLanguageStore((s) => s.language)
    const [doc, setDoc] = useState<SystemDocument | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        let active = true
        systemDocumentService
            .getBySlug(GUARANTEE_DOCUMENT_SLUG)
            .then((d) => { if (active) setDoc(d) })
            .catch(() => { if (active) setError(true) })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    if (loading) {
        return (
            <LoadingState variant="spinner" label="Cargando texto de garantía…" className="rounded-xl border border-rule py-6" />
        )
    }

    if (error || !doc) {
        return (
            <FeedbackBanner tone="danger" mode="blocking">
                No se pudo cargar el texto de garantía. Intenta de nuevo más tarde.
            </FeedbackBanner>
        )
    }

    // The PM's own session language; guests never see this screen, so there is
    // no negotiation with the reservation's communicationsLocale here. Texto y
    // valores salen del MISMO idioma: mezclarlos daría «Card on File» en español.
    const locale = doc.content[language] != null ? language : doc.content.es != null ? "es" : Object.keys(doc.content)[0]
    const content = (locale && doc.content[locale]) ?? ""
    // Solo las variables de la garantía, con los valores de la DB de HitGuest
    // (Ricardo, 2026-10-29). Las de cada reserva las resuelve HitGuest en el PDF.
    const { html, missing } = resolveGuaranteePreview(content, locale ? doc.extra?.[locale] : undefined)

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-3">
                <ShieldCheck size={14} className="text-primary" />
                Garantía de daños y consumos
                <span className="font-normal text-ink-3">— mantenida por HitGuest, no editable aquí</span>
            </div>

            {/* Sin decir que «aparecerán igual en el PDF»: HitGuest las vuelve a
                resolver al generarlo. Solo falta el dato para esta vista. */}
            {missing.length > 0 && (
                // Aparece cuando termina la carga: se anuncia sin interrumpir.
                <FeedbackBanner tone="warning" mode="dynamic" density="compact">
                    No pudimos cargar toda la configuración de garantía para esta previsualización.
                </FeedbackBanner>
            )}

            <div
                className="prose prose-sm max-w-none rounded-xl border border-rule bg-sunk/60 px-4 py-3 text-sm text-ink-2 [&_strong]:font-bold [&_p]:my-2"
                // Content comes from HitGuest's own system-documents endpoint, not
                // user input — same trust boundary as the rendered contract preview
                // elsewhere in the app (DocumentPreviewModal).
                dangerouslySetInnerHTML={{
                    __html: missing.length > 0 ? highlightMissing(html, missing) : html,
                }}
            />
        </div>
    )
}

/**
 * Resalta solo las variables de la garantía que faltaron. Las de cada reserva
 * ({{guest_first_name}}…) son esperadas y no se marcan. Fuera de los `href`,
 * donde un `<mark>` rompería el atributo.
 */
function highlightMissing(html: string, missing: string[]): string {
    const keys = missing.join("|")
    return html.replace(
        new RegExp(`(href=["'][^"']*)?\\{\\{\\s*(${keys})\\s*\\}\\}`, "gi"),
        (token, insideHref?: string) =>
            insideHref ? token : `<mark class="bg-warning-sunk rounded-xs px-0.5">${token}</mark>`,
    )
}
