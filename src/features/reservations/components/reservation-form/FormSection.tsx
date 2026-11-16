import { Heading } from "@/components/ui/heading"

/**
 * Una sección del formulario de reserva: título, una línea de ayuda opcional
 * y sus campos. Sin número ni caja: todas las secciones están a la vista
 * (no es un flujo por pasos) y la jerarquía la da el ritmo vertical.
 */
export function FormSection({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <section aria-label={title} className="space-y-4">
            <div className="space-y-0.5">
                <Heading level={3} size="section">{title}</Heading>
                {description && <p className="text-xs text-ink-3">{description}</p>}
            </div>
            {children}
        </section>
    )
}
