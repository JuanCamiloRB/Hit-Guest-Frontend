"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ShieldCheck, Loader2 } from "lucide-react"
import { useLanguageStore } from "@/store/useLanguageStore"
import {
    systemDocumentService,
    hasUnresolvedShortcodes,
    GUARANTEE_DOCUMENT_SLUG,
    type SystemDocument,
} from "../../services/system-document-service"

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
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin" />
                Cargando texto de garantía…
            </div>
        )
    }

    if (error || !doc) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                No se pudo cargar el texto de garantía. Intenta de nuevo más tarde.
            </div>
        )
    }

    // The PM's own session language; guests never see this screen, so there is
    // no negotiation with the reservation's communicationsLocale here.
    const content = doc.content[language] ?? doc.content.es ?? Object.values(doc.content)[0] ?? ""
    const unresolved = hasUnresolvedShortcodes(content)

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <ShieldCheck size={14} className="text-[var(--color-brand-purple)]" />
                Garantía de daños y consumos
                <span className="font-normal text-slate-400">— mantenida por HitGuest, no editable aquí</span>
            </div>

            {unresolved && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                        Este texto todavía tiene variables sin configurar (resaltadas abajo). Aparecerán
                        igual en el PDF firmado hasta que HitGuest las complete.
                    </span>
                </div>
            )}

            <div
                className="prose prose-sm max-w-none rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 [&_strong]:font-bold [&_p]:my-2"
                // Content comes from HitGuest's own system-documents endpoint, not
                // user input — same trust boundary as the rendered contract preview
                // elsewhere in the app (DocumentPreviewModal).
                dangerouslySetInnerHTML={{
                    __html: unresolved ? highlightUnresolved(content) : content,
                }}
            />
        </div>
    )
}

/** Wraps unresolved `{{...}}` tokens so they stand out in the preview. */
function highlightUnresolved(html: string): string {
    return html.replace(
        /\{\{[^{}]+\}\}/g,
        (token) => `<mark class="bg-amber-200/70 rounded px-0.5">${token}</mark>`,
    )
}
