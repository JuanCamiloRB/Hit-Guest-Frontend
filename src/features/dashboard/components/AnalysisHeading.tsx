/** Título de una columna del análisis del periodo: misma escala en historial y nodos. */
export function AnalysisHeading({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-0.5 text-sm text-ink-3">{description}</p>
        </div>
    )
}
