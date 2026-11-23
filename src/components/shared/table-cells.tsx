"use client"

import type * as React from "react"
import { MoreVertical, type LucideIcon } from "lucide-react"

import { ChannelLogo } from "@/components/brand/ChannelLogo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import { StatusTile } from "@/components/ui/status-tile"
import { TextLink, textLinkClasses } from "@/components/ui/text-link"
import { Toggletip, ToggletipLine, ToggletipTitle } from "@/components/ui/toggletip"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { cn } from "@/lib/utils"

/**
 * Las celdas que comparten TODAS las tablas de listado (estándar de tablas,
 * plan 20261120). Cada tabla muestra otra información, pero la misma clase de
 * dato se ve y se comporta igual en todas:
 *
 * - la primera columna dice quién o qué es la fila (`IdentityCell`);
 * - un canal o un origen lleva su logo y su nombre (`ChannelCell`);
 * - un dato contable lleva la celda de ancho fijo de Operaciones con su
 *   ícono y su detalle al pasar, enfocar o tocar (`DataTileCell`);
 * - una columna de ícono lleva el ícono sobre el nombre (`ColumnHeader`);
 * - lo que no existe es «—» en ink-4 (`AbsentValue`);
 * - las acciones van al final, en el menú «⋮» (`RowActionsMenu`, `ActionsHeader`).
 *
 * El detalle de una celda SIEMPRE va en `Toggletip`: nunca en `title` (no
 * existe en teclado ni en pantallas táctiles).
 */

/**
 * Encabezado de una columna de íconos: el ícono sobre el nombre. `mark` en
 * lugar de `icon` para una marca que no es de lucide (WhatsApp). Centrado sobre
 * celdas de estado; `align="end"` sobre montos, que van a la derecha. `inline`
 * pone el ícono a la izquierda del nombre, en una línea: la tabla cómoda
 * (Alojamientos), donde la columna va alineada a la izquierda.
 */
export function ColumnHeader({ icon, mark, label, align = "center", inline = false }: {
    icon?: LucideIcon
    mark?: React.ReactNode
    label: string
    align?: "center" | "end"
    inline?: boolean
}) {
    if (inline) {
        return (
            <span data-slot="column-header" data-layout="inline" className="inline-flex items-center gap-1.5">
                {mark ?? (icon && <Icon icon={icon} size="sm" />)}
                <span>{label}</span>
            </span>
        )
    }
    return (
        <span data-slot="column-header" className={cn("inline-flex flex-col gap-0.5", align === "end" ? "items-end" : "items-center")}>
            {mark ?? (icon && <Icon icon={icon} size="sm" />)}
            <span>{label}</span>
        </span>
    )
}

/** «No aplica» o «no declarado» (manual §3): el guion en ink-4, nunca un 0 ni un texto. */
export function AbsentValue() {
    return <span data-slot="absent-value" className="text-ink-4">—</span>
}

const NAME_OPENS = "font-semibold group-hover/row:text-primary-hover"

/**
 * Quién o qué es la fila: el nombre (enlace real si la fila navega) y una
 * línea secundaria. Una línea cada uno, recortadas al ancho de la columna
 * (`className`, solo layout); el texto completo sigue en el DOM para el lector.
 */
export function IdentityCell({ name, href, onOpen, secondary, linkProps, className }: {
    name: string
    href?: string | null
    /** En vez de navegar, abre algo (el diálogo de edición): mismo aspecto que el enlace. */
    onOpen?: () => void
    secondary?: React.ReactNode
    /** Eventos del enlace (precargar la ficha al pasar por encima). */
    linkProps?: Omit<React.ComponentProps<typeof TextLink>, "href" | "children">
    className?: string
}) {
    return (
        <div data-slot="identity-cell" className={cn("flex min-w-0 flex-col py-0.5", className)}>
            {/* El nombre en semibold. Si navega o abre, al pasar por la fila se
                pone en primary-hover: la fila entera dice «esto se abre». */}
            {href
                ? <TextLink href={href} {...linkProps} className={cn("truncate text-sm", NAME_OPENS)}>{name}</TextLink>
                : onOpen
                    ? <UnstyledButton onClick={onOpen} className={cn(textLinkClasses(), "truncate text-left text-sm", NAME_OPENS)}>{name}</UnstyledButton>
                    : <span className="truncate text-sm font-semibold text-ink">{name}</span>}
            {secondary && <span className="truncate text-xs text-ink-3">{secondary}</span>}
        </div>
    )
}

/**
 * Un canal u origen: el logo de la marca y su nombre (sin logo propio, la
 * marca neutra de `ChannelLogo`). Con `detail`, el nombre se pulsa y abre el
 * detalle como cualquier celda.
 */
export function ChannelCell({ channel, name, detail, detailLabel, chip = false }: {
    /** Slug o nombre con el que `ChannelLogo` busca la marca. */
    channel: string | null | undefined
    name: string
    detail?: React.ReactNode
    detailLabel?: string
    /** Dentro de un `Badge integration` (la conexión de un alojamiento con su PMS). */
    chip?: boolean
}) {
    const body = chip
        ? (
            <Badge tone="integration" size="md">
                <ChannelLogo channel={channel} className="h-4 w-4" />
                <span>{name}</span>
            </Badge>
        )
        : (
            <>
                <ChannelLogo channel={channel} className="h-4 w-4" />
                <span className="text-sm text-ink-2">{name}</span>
            </>
        )
    if (!detail) return <span data-slot="channel-cell" className="inline-flex items-center gap-2">{body}</span>
    return (
        <Toggletip label={detailLabel ?? name} content={detail}>
            <UnstyledButton data-slot="channel-cell" className="inline-flex items-center gap-2 rounded-xs text-left">
                {body}
            </UnstyledButton>
        </Toggletip>
    )
}

/**
 * Un dato contable en la celda de Operaciones (64 × 32): ícono + cifra en el
 * tono `data` (morado claro), con el detalle al pasar, enfocar o tocar. Sin
 * nada declarado, el guion punteado de «no declarado», que no se ofrece como
 * control. Si la cifra falta pero el detalle sí tiene datos (`declared`), la
 * celda muestra solo el ícono y sigue abriendo su detalle.
 */
export function DataTileCell({ icon, label, value, valueText, detail, declared = value !== null }: {
    icon: LucideIcon
    /** Lo que mide la columna («Capacidad»): título del detalle y parte del nombre accesible. */
    label: string
    value: number | null
    /** El dato dicho en palabras («Hasta 6 huéspedes, 2 baños»). */
    valueText?: string
    /** Detalle propio; sin él, el título y la cifra en palabras. */
    detail?: React.ReactNode
    /** Hay algo que mostrar aunque `value` sea `null`. */
    declared?: boolean
}) {
    if (!declared) return <StatusTile tone="none" label={`${label}: sin declarar`} disabled />
    const spoken = valueText ?? (value === null ? "sin declarar" : String(value))
    return (
        <Toggletip
            label={label}
            content={detail ?? (
                <>
                    <ToggletipTitle>{label}</ToggletipTitle>
                    <ToggletipLine icon={icon}>{spoken}</ToggletipLine>
                </>
            )}
        >
            <StatusTile tone="data" icon={icon} count={value === null ? undefined : String(value)} label={`${label}: ${spoken}`} />
        </Toggletip>
    )
}

/** El encabezado de la columna de acciones: existe para el lector, no ocupa ancho. */
export function ActionsHeader() {
    return <span className="sr-only">Acciones</span>
}

/**
 * El menú «⋮» de una fila, el mismo en todas las tablas: botón fantasma con
 * nombre propio («Acciones de Habitación Doble») y el menú alineado al final.
 * Los ítems son `DropdownMenuItem`.
 */
export function RowActionsMenu({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={label}>
                    <Icon icon={MoreVertical} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{children}</DropdownMenuContent>
        </DropdownMenu>
    )
}

/**
 * Las celdas de íconos en la fila apilada de móvil: ahí no hay encabezados,
 * así que cada celda lleva su nombre escrito debajo. La misma tira en
 * Operaciones (automatizaciones) y en Alojamientos (capacidad).
 */
export function MobileTileList({ label, items }: {
    /** Nombre de la lista para el lector («Automatizaciones y reportes»). */
    label: string
    items: readonly { key: string; label: string; tile: React.ReactNode }[]
}) {
    return (
        <ul data-slot="mobile-tile-list" className="flex flex-wrap gap-x-2 gap-y-3" aria-label={label}>
            {items.map((item) => (
                <li key={item.key} className="flex flex-col items-center gap-1">
                    {item.tile}
                    <span className="text-xs text-ink-3" aria-hidden="true">{item.label}</span>
                </li>
            ))}
        </ul>
    )
}
