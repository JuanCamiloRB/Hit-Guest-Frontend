import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Heading } from "./heading"
import { Icon } from "./icon"

/**
 * El contenedor de una pantalla del panel. El relleno exterior ya lo pone
 * `<main>` (AdminLayout); aquí solo van el ancho máximo y el espacio entre
 * bloques, iguales en todas las pantallas. Antes cada página traía su propio
 * `p-4 md:p-8` encima del de `<main>`: unas quedaban a 24 px del borde y otras
 * a 56 px.
 */
function Page({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="page"
            className={cn("mx-auto flex w-full max-w-400 min-w-0 flex-col gap-6", className)}
            {...props}
        />
    )
}

interface PageHeaderProps extends Omit<React.ComponentProps<"header">, "title"> {
    /** El `h1` de la pantalla. Una pantalla tiene uno solo. */
    title: React.ReactNode
    description?: React.ReactNode
    /** Botones de la pantalla («Nueva reserva»). En móvil bajan bajo el título. */
    actions?: React.ReactNode
    /** Sobre el título: la ruta de navegación. */
    eyebrow?: React.ReactNode
    /** Junto al título: un indicador de actualización, una pastilla de estado. */
    titleAddon?: React.ReactNode
}

/** El encabezado de una pantalla: ruta, `h1`, descripción y acciones. */
function PageHeader({ title, description, actions, eyebrow, titleAddon, className, ...props }: PageHeaderProps) {
    return (
        <header
            data-slot="page-header"
            className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}
            {...props}
        >
            <div className="min-w-0 flex-1">
                {eyebrow && <div className="mb-1">{eyebrow}</div>}
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Heading level={1} className="min-w-0 break-words">{title}</Heading>
                    {titleAddon}
                </div>
                {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
    )
}

interface BreadcrumbItem {
    label: React.ReactNode
    /** Sin `href` es la pantalla actual (`aria-current="page"`). */
    href?: string
}

/** La ruta de navegación sobre el título: enlaces reales, la última es la actual. */
function PageBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
    return (
        <nav aria-label="Ruta de navegación" className={className}>
            <ol className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-3">
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <li aria-hidden="true" className="flex">
                                <Icon icon={ChevronRight} size="xs" className="text-ink-4" />
                            </li>
                        )}
                        {item.href ? (
                            <li>
                                <Link
                                    href={item.href}
                                    className="rounded-xs transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ) : (
                            <li aria-current="page" className="truncate font-semibold text-ink-2">
                                {item.label}
                            </li>
                        )}
                    </React.Fragment>
                ))}
            </ol>
        </nav>
    )
}

export { Page, PageHeader, PageBreadcrumb, type BreadcrumbItem }
