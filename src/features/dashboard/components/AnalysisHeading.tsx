
import { Heading } from "@/components/ui/heading"/** Título de una columna del análisis del periodo: misma escala en historial y nodos. */
export function AnalysisHeading({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <Heading level={3} size="subsection">{title}</Heading>
            <p className="mt-0.5 text-sm text-ink-3">{description}</p>
        </div>
    )
}
