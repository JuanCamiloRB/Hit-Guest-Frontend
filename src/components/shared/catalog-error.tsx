"use client"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/form"

/**
 * Un catálogo que no cargó, dicho junto a su campo y con «Reintentar» (la
 * misma forma que el aviso de canales). `aria-disabled`, no `disabled`: el
 * foco se queda en el botón mientras reintenta.
 */
export function CatalogError({
    what,
    consequence,
    retrying,
    onRetry,
}: {
    /** «las propiedades», «los países», «las monedas». */
    what: string
    /** Qué no se puede hacer sin él; omitido si el campo tiene respaldo. */
    consequence?: string
    retrying: boolean
    onRetry: () => void
}) {
    return (
        <FieldError role="alert">
            No pudimos cargar {what}.{consequence ? ` ${consequence}` : ""}{" "}
            <Button variant="link" size="inline" type="button" aria-disabled={retrying} onClick={() => { if (!retrying) onRetry() }}>
                {retrying ? "Reintentando…" : "Reintentar"}
            </Button>
        </FieldError>
    )
}
