import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"
import { Input } from "./input"

/**
 * El buscador de una lista: la lupa dentro del campo, a la izquierda, en
 * `primary` (la lupa es la señal de «esto se escribe y filtra»). Es un `Input`
 * de tipo `search` con todo su estado (borde de campo, hover, foco, deshabilitado).
 *
 * Nombre accesible: `label` (va en `aria-label`) o un `Label htmlFor` propio de
 * la pantalla con el mismo `id`. `size="lg"` (44 px) junto a un `Button size="lg"`;
 * `size="sm"` (36 px) en la barra densa de una tarjeta (el Tablero).
 * `className` es solo layout del contenedor (ancho, flex).
 */
interface SearchFieldProps extends Omit<React.ComponentProps<"input">, "type" | "size"> {
    /** Nombre accesible si la pantalla no pone un `Label` propio. */
    label?: string
    size?: "sm" | "default" | "lg"
}

function SearchField({ label, size = "default", className, ...props }: SearchFieldProps) {
    return (
        <div data-slot="search-field" className={cn("relative", className)}>
            <Icon icon={Search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
            <Input type="search" aria-label={label} className={cn("pl-9", size === "lg" && "h-11", size === "sm" && "h-9")} {...props} />
        </div>
    )
}

export { SearchField, type SearchFieldProps }
