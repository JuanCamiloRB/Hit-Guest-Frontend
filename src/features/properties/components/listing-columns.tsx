"use client"

import type * as React from "react"
import type { ColumnDef, SortingFn } from "@tanstack/react-table"
import { Bath, BedDouble, Building2, Hash, Users, type LucideIcon } from "lucide-react"

import { AbsentValue, ChannelCell, ColumnHeader, DataTileCell, IdentityCell, MobileTileList } from "@/components/shared/table-cells"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { StatusPill } from "@/components/ui/status-pill"
import { TextLink } from "@/components/ui/text-link"
import { ToggletipLine, ToggletipTitle } from "@/components/ui/toggletip"
import { formatMoney } from "@/lib/money"
import type { ExternalPmsConnection } from "../lib/external-pms-ids"
import type { PortfolioListing } from "../lib/properties-cache"

/**
 * Las columnas de un alojamiento, las MISMAS en las dos tablas que los listan:
 * la pestaña Alojamientos de Propiedades y la pestaña Alojamientos de una
 * propiedad. Siguen el estándar de tablas (plan 20261120): identidad fija a la
 * izquierda, canal con logo, datos contables en la celda de Operaciones con su
 * detalle, estado con `StatusPill`, dinero a la derecha.
 */
export interface ListingTableRow {
    id: string
    name: string
    /** Número o nombre interno («HAB-DOB»). */
    number: string
    /** `null` = la tabla no muestra la columna Propiedad (dentro de la propiedad). */
    propertyName: string | null
    /** La ficha de la propiedad; `null` = el nombre no navega. */
    propertyHref: string | null
    status: "ACTIVE" | "INACTIVE"
    capacity: number | null
    bedrooms: number | null
    bathrooms: number | null
    pricePerNight: number | null
    currency: string | null
    /** `[]` = la respuesta afirma que no hay vínculo; `null` = no lo dice. */
    connections: ExternalPmsConnection[] | null
    /** A dónde lleva la fila; `null` = no navega. */
    href: string | null
}

/** Un alojamiento leído por `toListing` (portafolio o fila del editor) como fila de la tabla. */
export function toListingTableRow(
    listing: PortfolioListing,
    { propertyName, propertyHref = null, href }: { propertyName: string | null; propertyHref?: string | null; href: string | null },
): ListingTableRow {
    return {
        id: String(listing.id),
        name: listing.name ?? "",
        number: listing.number ?? "",
        propertyName,
        propertyHref,
        status: listing.status,
        capacity: listing.capacity,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        pricePerNight: listing.pricePerNight,
        currency: listing.currency,
        connections: listing.connections,
        href,
    }
}

export const STATUS_LABEL: Record<ListingTableRow["status"], string> = { ACTIVE: "Activo", INACTIVE: "Inactivo" }
const UNLINKED_LABEL = "Sin vincular"

/** El nombre del origen; sin nombre en la respuesta, su id (como el formulario: «Origen #134»). */
export function connectionName(connection: ExternalPmsConnection): string {
    return connection.sourceName ?? `Origen #${connection.sourcePmsId}`
}

/**
 * Sin esto TanStack ELIGE la función de orden muestreando las filas a partir de
 * la 11.ª: con ≤10 resultados ordena por código de carácter (mayúsculas antes,
 * «Álamo» después de «Zebra») y con más cambia de criterio bajo el usuario.
 */
const TEXT_COLLATOR = new Intl.Collator("es", { sensitivity: "base", numeric: true })
const byText: SortingFn<ListingTableRow> = (a, b, columnId) =>
    TEXT_COLLATOR.compare(String(a.getValue(columnId) ?? ""), String(b.getValue(columnId) ?? ""))

/**
 * El valor de orden de la conexión es el MISMO texto que se ve: ordena
 * alfabético y es estable. Solo «no se sabe» (`null`) va al final; si «Sin
 * vincular» también fuera `undefined`, TanStack los mezclaría en cualquier orden.
 */
function connectionsText(connections: ListingTableRow["connections"]): string | undefined {
    if (connections === null) return undefined
    if (connections.length === 0) return UNLINKED_LABEL
    return connections.map(connectionName).join(" · ")
}

interface Fact {
    key: "capacity" | "bedrooms" | "bathrooms"
    icon: LucideIcon
    /** Encabezado y título del detalle. */
    label: string
    words: (value: number) => string
}

/** «Habitaciones o camas» es la palabra del campo del formulario (`bedRoom`). */
const FACTS: readonly Fact[] = [
    { key: "capacity", icon: Users, label: "Huéspedes", words: (n) => `Hasta ${n} ${n === 1 ? "huésped" : "huéspedes"}` },
    { key: "bedrooms", icon: BedDouble, label: "Habitaciones", words: (n) => `${n} ${n === 1 ? "habitación o cama" : "habitaciones o camas"}` },
    { key: "bathrooms", icon: Bath, label: "Baños", words: (n) => `${n} ${n === 1 ? "baño" : "baños"}` },
]

/**
 * El detalle de la celda de capacidad: huéspedes, habitaciones y baños. Lo no
 * declarado se dice, no se rellena con el 1 por omisión del formulario.
 */
function CapacityDetail({ row }: { row: ListingTableRow }) {
    return (
        <>
            <ToggletipTitle>Capacidad · {row.name}</ToggletipTitle>
            {FACTS.map((fact) => {
                const value = row[fact.key]
                return (
                    <ToggletipLine key={fact.key} icon={fact.icon}>
                        {value === null ? `${fact.label}: sin declarar` : fact.words(value)}
                    </ToggletipLine>
                )
            })}
        </>
    )
}

function ConnectionDetail({ connection }: { connection: ExternalPmsConnection }) {
    return (
        <>
            <ToggletipTitle>Conexión con {connectionName(connection)}</ToggletipTitle>
            <ToggletipLine icon={Hash}>ID en {connectionName(connection)}: {connection.externalId}</ToggletipLine>
        </>
    )
}

/** Con qué PMS o canal está vinculado: logo + nombre, y el id externo en el detalle. */
export function ListingConnections({ connections }: { connections: ListingTableRow["connections"] }) {
    if (connections === null) return <AbsentValue />
    if (connections.length === 0) return <Badge tone="neutral" size="md">{UNLINKED_LABEL}</Badge>
    return (
        <span className="flex flex-col items-start gap-1">
            {connections.map((connection) => (
                <ChannelCell
                    key={connection.id ?? `${connection.sourcePmsId}:${connection.externalId}`}
                    channel={connection.sourceName}
                    name={connectionName(connection)}
                    detail={<ConnectionDetail connection={connection} />}
                    chip
                />
            ))}
        </span>
    )
}

/** La capacidad dicha entera: «Hasta 6 huéspedes, 3 habitaciones o camas, baños sin declarar». */
function capacityText(row: ListingTableRow): string {
    return FACTS.map((fact) => {
        const value = row[fact.key]
        return value === null ? `${fact.label.toLowerCase()} sin declarar` : fact.words(value)
    }).join(", ")
}

/**
 * Una sola celda para la capacidad: el ícono de huéspedes y su cifra, en el
 * morado claro de dato; habitaciones y baños, en el detalle. Sin huéspedes pero
 * con otro dato, solo el ícono (el detalle dice qué hay). Sin nada, punteada.
 */
export function CapacityCell({ row }: { row: ListingTableRow }) {
    return (
        <DataTileCell
            icon={Users}
            label="Capacidad"
            value={row.capacity}
            declared={FACTS.some((fact) => row[fact.key] !== null)}
            valueText={capacityText(row)}
            detail={<CapacityDetail row={row} />}
        />
    )
}

/** La celda de capacidad con su nombre debajo, en la fila apilada de móvil (como Operaciones). */
export function ListingCapacityTile({ row }: { row: ListingTableRow }) {
    return <MobileTileList label="Capacidad" items={[{ key: "capacity", label: "Capacidad", tile: <CapacityCell row={row} /> }]} />
}

/** El precio por noche en el chip de dato (morado claro; se llena al pasar por la fila). Sin precio, «—». */
export function ListingPrice({ row }: { row: ListingTableRow }) {
    if (row.pricePerNight === null) return <AbsentValue />
    return <Badge tone="data" size="md" className="tabular-nums">{formatMoney(row.pricePerNight, row.currency)}</Badge>
}

/**
 * La propiedad del alojamiento: el edificio y el nombre, que lleva a su ficha.
 * El ícono va en primary solo cuando el nombre navega (morado = se pulsa);
 * sin enlace, en ink-3 como cualquier ícono de dato.
 */
export function ListingProperty({ row, className }: { row: ListingTableRow; className?: string }) {
    if (!row.propertyName) return <AbsentValue />
    if (!row.propertyHref) {
        return (
            <span className={`inline-flex max-w-full items-center gap-1.5 text-sm text-ink-2 ${className ?? ""}`}>
                <Icon icon={Building2} size="sm" className="text-ink-3" />
                <span className="truncate">{row.propertyName}</span>
            </span>
        )
    }
    return (
        <TextLink href={row.propertyHref} tone="muted" className={`inline-flex max-w-full items-center gap-1.5 text-sm ${className ?? ""}`}>
            <Icon icon={Building2} size="sm" className="text-primary" />
            <span className="truncate">{row.propertyName}</span>
        </TextLink>
    )
}

export function ListingStatus({ status }: { status: ListingTableRow["status"] }) {
    return <StatusPill tone={status === "ACTIVE" ? "success" : "idle"}>{STATUS_LABEL[status]}</StatusPill>
}

/**
 * El ancho de las columnas de texto: 224 px desde 1024 px de tabla; 192 px por
 * debajo, que es lo que deja caber la tabla cómoda a 1280 px de ventana.
 */
const TEXT_COLUMN = "max-w-48 @5xl:max-w-56"

/**
 * Las columnas, en este orden: Alojamiento, Propiedad (si se pide), Conexión,
 * Estado, Capacidad (una celda; huéspedes, habitaciones y baños en el detalle), Precio por noche y, si la
 * tabla edita, las acciones.
 */
export function listingColumns({ withProperty, actions, onOpen }: {
    withProperty: boolean
    /** La columna de acciones (menú «⋮») de la tabla que edita. */
    actions?: ColumnDef<ListingTableRow>
    /** El nombre abre la edición en vez de navegar (tabla del editor de la propiedad). */
    onOpen?: (row: ListingTableRow) => void
}): ColumnDef<ListingTableRow>[] {
    return [
        {
            id: "name",
            accessorFn: (row) => row.name,
            sortingFn: byText,
            header: "Alojamiento",
            // Fija al desplazar la tabla de lado, como el huésped en Operaciones.
            meta: { sticky: "left", headerTone: "accent" },
            cell: ({ row }) => (
                <IdentityCell
                    name={row.original.name || "Sin nombre"}
                    href={row.original.href}
                    onOpen={onOpen ? () => onOpen(row.original) : undefined}
                    secondary={row.original.number || undefined}
                    className={TEXT_COLUMN}
                />
            ),
        },
        ...(withProperty ? [{
            id: "property",
            accessorFn: (row: ListingTableRow) => row.propertyName ?? "",
            sortingFn: byText,
            header: "Propiedad",
            cell: ({ row }: { row: { original: ListingTableRow } }) => <ListingProperty row={row.original} className={TEXT_COLUMN} />,
        } satisfies ColumnDef<ListingTableRow>] : []),
        {
            id: "connection",
            accessorFn: (row) => connectionsText(row.connections),
            sortingFn: byText,
            sortUndefined: "last",
            // Sin esto TanStack decide la dirección del primer clic por el valor de
            // la primera fila: si es `undefined`, empezaba de Z a A.
            sortDescFirst: false,
            header: "Conexión",
            cell: ({ row }) => <ListingConnections connections={row.original.connections} />,
        },
        {
            id: "status",
            accessorFn: (row) => STATUS_LABEL[row.status],
            sortingFn: byText,
            header: "Estado",
            cell: ({ row }) => <ListingStatus status={row.original.status} />,
        },
        {
            id: "capacity",
            accessorFn: (row) => row.capacity ?? undefined,
            // Ordena por huéspedes; sin dato, al final en los dos sentidos; el primer clic, de menor a mayor.
            sortUndefined: "last",
            sortDescFirst: false,
            header: () => <ColumnHeader icon={Users} label="Capacidad" inline />,
            cell: ({ row }) => <CapacityCell row={row.original} />,
        },
        {
            id: "price",
            accessorFn: (row) => row.pricePerNight ?? undefined,
            sortUndefined: "last",
            sortDescFirst: false,
            header: "Precio por noche",
            meta: { headerTone: "soft", headerClassName: "text-right", cellClassName: "text-right" },
            cell: ({ row }) => <ListingPrice row={row.original} />,
        },
        ...(actions ? [actions] : []),
    ]
}

/**
 * La fila apilada de móvil: la misma información y las mismas celdas que la
 * tabla (identidad, estado, propiedad, conexión, capacidad, precio), y el menú
 * de acciones si la tabla edita.
 */
export function ListingMobileRow({ row, actions, onOpen }: { row: ListingTableRow; actions?: React.ReactNode; onOpen?: () => void }) {
    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <IdentityCell name={row.name || "Sin nombre"} href={row.href} onOpen={onOpen} secondary={row.number || undefined} />
                <div className="flex shrink-0 items-center gap-2">
                    <ListingStatus status={row.status} />
                    {actions}
                </div>
            </div>
            {row.propertyName && <ListingProperty row={row} />}
            {row.connections !== null && <ListingConnections connections={row.connections} />}
            <div className="flex items-end justify-between gap-3">
                <ListingCapacityTile row={row} />
                <ListingPrice row={row} />
            </div>
        </div>
    )
}
