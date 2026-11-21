"use client"

import { ColumnDef, SortingFn } from "@tanstack/react-table"
import { UNKNOWN_CHANNEL_LABEL } from "@/lib/reservation-channel"
import { cancelDetailPrefetch, startDetailPrefetch } from "../lib/detail-prefetch"
import { CircleHelp, RefreshCw, Trash2, type LucideIcon } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { ChannelLogo } from "@/components/brand/ChannelLogo"
import Link from "next/link"

import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { Reservation } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { getReservationStatusMeta } from "./reservation-status-meta"
import { compareText, compareDates, compareStatus } from "./reservation-sorting"
import { TextLink } from "@/components/ui/text-link"
import { StatusTile, StatusTileSkeleton, type StatusTileTone } from "@/components/ui/status-tile"
import { AUTOMATION_ICONS } from "@/components/shared/automation-icons"
import { ChannelCell, ColumnHeader, IdentityCell, MobileTileList, RowActionsMenu } from "@/components/shared/table-cells"
import { Toggletip, ToggletipLine, ToggletipNote, ToggletipTitle, type ToggletipTone } from "@/components/ui/toggletip"
import { DeliveryChannelIcon } from "@/components/brand/DeliveryChannelIcon"
import { useLinkAttempts } from "../hooks/useLinkAttempts"
import { attemptLines } from "../lib/link-attempts"
import {
    CELL_KEYS,
    CELL_LABELS,
    CELL_SEVERITY,
    buildAutomationCells,
    cellAccessibleName,
    classifyItem,
    type AutomationCell,
    type CellKey,
    type CellState,
} from "../lib/automation-cells"

export interface ColumnsOptions {
    /** Las columnas de automatización que se muestran (`visibleCellKeys`); sin esto, todas. */
    cellKeys?: readonly CellKey[]
    onDelete?: (reservation: Reservation) => void
    /** Reintenta el semáforo de una fila cuya consulta falló. */
    onRetryStatus?: (reservation: Reservation) => void
}

// Los comparadores viven en reservation-sorting.ts (puros y testeados); aquí
// solo se adaptan a la firma que espera TanStack.
const sortByGuest: SortingFn<Reservation> = (a, b) =>
    compareText(a.original.guestName, b.original.guestName)

const sortByCheckIn: SortingFn<Reservation> = (a, b) =>
    compareDates(a.original.checkIn, b.original.checkIn)

const sortBySource: SortingFn<Reservation> = (a, b) =>
    // Sin canal, al final (como una fecha ausente), no primero por ser texto vacío.
    a.original.source && b.original.source
        ? compareText(a.original.source, b.original.source)
        : a.original.source ? -1 : b.original.source ? 1 : 0

const sortByStatus: SortingFn<Reservation> = (a, b) =>
    compareStatus(a.original.status, b.original.status)

/** El ícono de lo que mide cada columna; el nombre va escrito debajo, en el encabezado. */
/** Los íconos de toda la app (`AUTOMATION_ICONS`): los mismos en el Tablero. */
const CELL_ICONS: Record<CellKey, LucideIcon> = {
    link: AUTOMATION_ICONS.link,
    checkin: AUTOMATION_ICONS.identity,
    contract: AUTOMATION_ICONS.contract,
    code: AUTOMATION_ICONS.access,
    tra: AUTOMATION_ICONS.tra,
    sireIn: AUTOMATION_ICONS.sire,
    sireOut: AUTOMATION_ICONS.sireOut,
    pdf: AUTOMATION_ICONS.pdf,
}

/** El título del detalle: más largo que el encabezado, que tiene que caber en 64 px. */
const CELL_TITLES: Record<CellKey, string> = {
    link: "Link de check-in",
    checkin: "Check-in",
    contract: "Contrato",
    code: "Acceso",
    tra: "Reporte TRA",
    sireIn: "SIRE entrada",
    sireOut: "SIRE salida",
    pdf: "Reporte PDF de huéspedes",
}

const TILE_TONE: Record<CellState, StatusTileTone & ToggletipTone> = {
    success: "success",
    pending: "warning",
    failed: "danger",
    idle: "idle",
    none: "none",
}

/** Las ocho celdas de una fila, de lo que ya trae (sin peticiones). */
function cellsOf(reservation: Reservation, forSort = false) {
    return buildAutomationCells({
        items: forSort ? reservation.automationItemsForSort : reservation.automationItems,
        delivery: reservation.checkinLinkDelivery,
        contract: reservation.digitalContract,
        checkin: {
            completed: reservation.completedGuests ?? null,
            total: reservation.totalGuests,
            isCheckinCompleted: reservation.isCheckinCompleted === true,
        },
        inactiveSlugs: reservation.propertyInactiveAutomations,
    })
}

function CellHeader({ cellKey }: { cellKey: CellKey }) {
    return <ColumnHeader icon={CELL_ICONS[cellKey]} label={CELL_LABELS[cellKey]} />
}

/**
 * El detalle del Link: lo que trae la reserva (cada canal con su entrega, hora
 * y destinatario) MÁS los canales que se saltaron y por qué, que solo están en
 * el historial y se piden al abrir este detalle.
 */
function LinkCellDetail({ reservation, cell }: { reservation: Reservation; cell: AutomationCell }) {
    const linkItem = reservation.automationItems?.find((item) => classifyItem(item) === "link")
    const attempts = useLinkAttempts(reservation.id, linkItem?.automationUuid ?? null)
    const extra = attempts.status === "ready" ? attemptLines(attempts.attempts, reservation.checkinLinkDelivery) : []
    return (
        <>
            <ToggletipTitle>{CELL_TITLES.link}</ToggletipTitle>
            {cell.lines.map((line, index) => (
                <ToggletipLine key={`d${index}`} tone={TILE_TONE[line.state]}>{line.text}</ToggletipLine>
            ))}
            {extra.map((line, index) => (
                <ToggletipLine key={`h${index}`} tone={TILE_TONE[line.state]}>{line.text}</ToggletipLine>
            ))}
            {attempts.status === "loading" && <ToggletipLine tone="idle">Buscando los otros canales…</ToggletipLine>}
            {attempts.status === "error" && (
                <ToggletipNote>No se pudo leer el historial de envíos: puede haber canales que no aparecen aquí.</ToggletipNote>
            )}
            {cell.note && <ToggletipNote>{cell.note}</ToggletipNote>}
        </>
    )
}

function CellDetail({ cellKey, cell }: { cellKey: CellKey; cell: AutomationCell }) {
    return (
        <>
            <ToggletipTitle>{CELL_TITLES[cellKey]}</ToggletipTitle>
            {cell.lines.map((line, index) => (
                <ToggletipLine key={index} tone={TILE_TONE[line.state]}>{line.text}</ToggletipLine>
            ))}
            {cell.note && <ToggletipNote>{cell.note}</ToggletipNote>}
        </>
    )
}

/**
 * Una celda: ícono + marca de estado + contador, del mismo ancho en todas las
 * columnas, con el detalle al pasar, enfocar o tocar. Mientras su fuente no
 * llega, el esqueleto del mismo tamaño; si la consulta falló, «no disponible»
 * (nunca «—», que significa «no configurada») y, en la primera celda que falte,
 * el reintento: una sola consulta trae todas las celdas de la fila.
 */
function AutomationCellView({ cellKey, reservation, onRetry }: {
    cellKey: CellKey
    reservation: Reservation
    onRetry?: (reservation: Reservation) => void
}) {
    const cells = cellsOf(reservation)
    const cell = cells[cellKey]
    if (cell === null) {
        if (!reservation.automationStatusFailed) return <StatusTileSkeleton />
        const retryHere = onRetry && CELL_KEYS.find((key) => cells[key] === null) === cellKey
        // Sin `title` y sin detalle: es una ACCIÓN (un Toggletip la fijaba con el
        // mismo clic que reintenta); su nombre accesible ya dice qué hace.
        return retryHere ? (
            <StatusTile
                tone="idle"
                icon={RefreshCw}
                label={`No disponible. Reintentar el estado de ${reservation.guestName}`}
                onClick={() => onRetry(reservation)}
            />
        ) : (
            // NO el guion de «no configurada»: sin dato es «no sabemos», con su propio ícono.
            <StatusTile tone="idle" icon={CircleHelp} label={`${CELL_LABELS[cellKey]}: no disponible`} disabled />
        )
    }
    const tone = TILE_TONE[cell.state]
    const label = cellAccessibleName(cellKey, cell)
    if (cell.state === "none") return <StatusTile tone="none" label={label} disabled />
    const count = cell.count ? `${cell.count.done}/${cell.count.total}` : undefined
    // «0/13» ya no cabe junto al ícono en 64 px (medido en producción): ahí manda
    // el número; el ícono ya está en el encabezado de la columna.
    const icon = cell.channels?.length || (count && count.length >= 4) ? undefined : CELL_ICONS[cellKey]
    const tile = (
        <StatusTile tone={tone} label={label} icon={icon} count={count}>
            {cell.channels?.length ? (
                <span className="inline-flex items-center gap-0.5">
                    {cell.channels.map((channel) => <DeliveryChannelIcon key={channel} channel={channel} />)}
                </span>
            ) : undefined}
        </StatusTile>
    )
    const detail = cellKey === "link"
        ? <LinkCellDetail reservation={reservation} cell={cell} />
        : <CellDetail cellKey={cellKey} cell={cell} />
    return <Toggletip label={CELL_TITLES[cellKey]} content={detail}>{tile}</Toggletip>
}

/** Una columna de automatización: encabezado con ícono y nombre, orden por severidad. */
function automationColumn(cellKey: CellKey, onRetry?: (reservation: Reservation) => void): ColumnDef<Reservation> {
    return {
        id: cellKey,
        header: () => <CellHeader cellKey={cellKey} />,
        // Relleno lateral mínimo: ocho columnas de estado tienen que caber en 1440 px.
        meta: { headerClassName: "px-1 text-center", cellClassName: "px-1 text-center" },
        // Sin `accessorFn` sería una display column y TanStack no la dejaría
        // ordenar. El valor es la SEVERIDAD de la celda en la foto de orden:
        // pulsar CONTRATO responde «¿cuáles me faltan?». Sin dato todavía
        // (cargando o fallido) queda al final en los dos sentidos.
        accessorFn: (row: Reservation) => {
            const cell = cellsOf(row, true)[cellKey]
            return cell ? CELL_SEVERITY[cell.state] : undefined
        },
        sortUndefined: "last",
        // TanStack decide la primera dirección mirando el valor de la primera
        // fila; sin dato todavía empezaría al revés. Primero lo que pide atención.
        sortDescFirst: false,
        cell: ({ row }) => <AutomationCellView cellKey={cellKey} reservation={row.original} onRetry={onRetry} />,
    }
}

/** El menú de acciones de una reserva: en la fila de la tabla y en la fila apilada de móvil. */
function ReservationActions({ reservation, onDelete }: { reservation: Reservation; onDelete?: (reservation: Reservation) => void }) {
    return (
        <RowActionsMenu label={`Acciones de la reserva de ${reservation.guestName}`}>
                <DropdownMenuItem
                    onClick={() => navigator.clipboard.writeText(reservation.id)}
                >
                    Copiar ID
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={`/dashboard/reservations/${reservation.id}`}>
                        Ver detalles
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!reservation.email}
                    onClick={() => {
                        if (!reservation.email) return
                        const subject = encodeURIComponent(`Tu reserva ${reservation.id}`)
                        const body = encodeURIComponent(`Hola ${reservation.guestName ?? ""},\n\n`)
                        window.open(`mailto:${reservation.email}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer")
                    }}
                >
                    Mensaje
                </DropdownMenuItem>
                {onDelete && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-danger focus:bg-danger-sunk focus:text-danger"
                            onClick={() => onDelete(reservation)}
                        >
                            <Icon icon={Trash2} className="mr-2" />
                            Eliminar
                        </DropdownMenuItem>
                    </>
                )}
        </RowActionsMenu>
    )
}

/**
 * La fila apilada de móvil (bajo `md`): quién, dónde, cuándo y el estado arriba;
 * debajo las ocho celdas con su nombre escrito, porque aquí no hay
 * encabezados. Las mismas celdas y el mismo detalle que en la tabla.
 */
export function ReservationMobileRow({ reservation, onDelete, onRetryStatus, cellKeys = CELL_KEYS }: { reservation: Reservation } & ColumnsOptions) {
    const meta = getReservationStatusMeta(reservation.status, reservation.statusLabel, reservation.statusId)
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <TextLink
                        href={`/dashboard/reservations/${reservation.id}`}
                        className="truncate text-sm"
                        // Como en la fila de escritorio: enfocar (o tocar) precarga la ficha.
                        onMouseEnter={() => startDetailPrefetch(reservation.id)}
                        onMouseLeave={() => cancelDetailPrefetch(reservation.id)}
                        onFocus={() => startDetailPrefetch(reservation.id)}
                        onBlur={() => cancelDetailPrefetch(reservation.id)}
                    >
                        {reservation.guestName}
                    </TextLink>
                    <span className="truncate text-xs text-ink-2">
                        {reservation.unitName}
                        {reservation.propertyName && reservation.unitName !== reservation.propertyName && <> · {reservation.propertyName}</>}
                    </span>
                    <span className="text-xs text-ink-3 tabular-nums">
                        {format(new Date(reservation.checkIn), "d MMM", { locale: es })} – {format(new Date(reservation.checkOut), "d MMM", { locale: es })}
                        {" · "}{reservation.nights} {reservation.nights === 1 ? "noche" : "noches"}
                    </span>
                    {/* El logo es decorativo: el nombre del canal va siempre al lado. */}
                    <span className="flex items-center gap-1.5 text-xs text-ink-2">
                        {reservation.source ? (
                            <>
                                <ChannelLogo channel={reservation.sourceSlug ?? reservation.source} className="h-3.5 w-3.5" />
                                {reservation.source}
                            </>
                        ) : (
                            <span className="text-ink-4">{UNKNOWN_CHANNEL_LABEL}</span>
                        )}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    <ReservationActions reservation={reservation} onDelete={onDelete} />
                </div>
            </div>
            <MobileTileList
                label="Automatizaciones y reportes"
                items={cellKeys.map((key) => ({
                    key,
                    label: CELL_LABELS[key],
                    tile: <AutomationCellView cellKey={key} reservation={reservation} onRetry={onRetryStatus} />,
                }))}
            />
        </div>
    )
}

export function getColumns(options?: ColumnsOptions): ColumnDef<Reservation>[] {
  const { onDelete, onRetryStatus, cellKeys = CELL_KEYS } = options || {}
  const shown = (keys: readonly CellKey[]) => keys.filter((key) => cellKeys.includes(key))
  const automations = shown(["link", "checkin", "contract", "code"])
  const reports = shown(["tra", "sireIn", "sireOut", "pdf"])
  return [
    {
        accessorKey: "guestName",
        header: "Huésped / Alojamiento",
        sortingFn: sortByGuest,
        // Fija al desplazar la tabla de lado: con ocho celdas de estado la
        // tabla no cabe en una laptop y el huésped no puede perderse.
        meta: { sticky: "left" },
        cell: ({ row }) => {
            const reservation = row.original
            // Sin avatar de iniciales: repetía el nombre de al lado («H2» por
            // «Huésped 26») y hacía cada fila de 85 px. Dos líneas: quién y dónde.
            return (
                <IdentityCell
                    name={reservation.guestName}
                    href={`/dashboard/reservations/${reservation.id}`}
                    className="max-w-44"
                    // Quedarse sobre la fila (o enfocarla) precarga la ficha.
                    linkProps={{
                        onMouseEnter: () => startDetailPrefetch(reservation.id),
                        onMouseLeave: () => cancelDetailPrefetch(reservation.id),
                        onFocus: () => startDetailPrefetch(reservation.id),
                        onBlur: () => cancelDetailPrefetch(reservation.id),
                    }}
                    // Alojamiento primero y propiedad después: el PM identifica la
                    // unidad concreta, no el edificio. La propiedad queda vacía
                    // mientras el portafolio no responde: sin texto que parezca un
                    // fallo mientras solo está cargando.
                    secondary={<>
                        <span className="text-ink-2">{reservation.unitName}</span>
                        {reservation.propertyName && reservation.unitName !== reservation.propertyName && (
                            <> · {reservation.propertyName}</>
                        )}
                    </>}
                />
            )
        }
    },
    {
        accessorKey: "checkIn",
        header: "Fechas",
        sortingFn: sortByCheckIn,
        cell: ({ row }) => {
            const checkIn = new Date(row.original.checkIn)
            const checkOut = new Date(row.original.checkOut)
            const nights = row.original.nights

            return (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink text-nowrap tabular-nums">
                        {format(checkIn, "d MMM", { locale: es })} – {format(checkOut, "d MMM", { locale: es })}
                    </span>
                    <span className="text-xs text-ink-3">
                        {nights} {nights === 1 ? "noche" : "noches"}
                    </span>
                </div>
            )
        }
    },
    {
        accessorKey: "source",
        header: "Origen",
        sortingFn: sortBySource,
        cell: ({ row }) => {
            const { source, sourceSlug } = row.original
            // Sin canal informado se dice; nunca se asume «Directo».
            if (!source) return <span className="text-sm text-ink-4">{UNKNOWN_CHANNEL_LABEL}</span>
            // Logo real de la marca (simple-icons) y su nombre: la misma celda que
            // la conexión de un alojamiento.
            return <ChannelCell channel={sourceSlug ?? source} name={source} />
        }
    },
    {
        accessorKey: "status",
        // Texto plano, no un <div> centrado: ahora el encabezado va dentro del
        // botón de orden, y un bloque centrado ahí dentro no centra nada.
        header: "Estado",
        sortingFn: sortByStatus,
        // Palabra + punto de color (StatusPill), como en la ficha: antes era solo
        // un ícono con el texto en un `aria-label` sobre un <span> sin rol, que
        // el lector no siempre anuncia y que el ojo no distingue sin leyenda.
        // Solo el estado: «automatizaciones activas» no se puede afirmar desde la
        // reserva (propiedad, alojamiento o la automatización pueden estar
        // apagados); el estado real de cada una está en sus columnas.
        cell: ({ row }) => {
            const { status, statusLabel, statusId } = row.original
            const meta = getReservationStatusMeta(status, statusLabel, statusId)
            return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        },
    },
    // Una columna por automatización, agrupadas como las lee el PM: lo que pasa
    // con el huésped y lo que se reporta a las autoridades.
    {
        id: "automations",
        header: "Automatizaciones",
        meta: { headerClassName: "text-center" },
        columns: automations.map((key) => automationColumn(key, onRetryStatus)),
    },
    // Un grupo sin columnas (ninguna propiedad reporta nada) no se dibuja.
    ...(reports.length > 0 ? [{
        id: "reports",
        header: "Reportes",
        meta: { headerClassName: "text-center" },
        columns: reports.map((key) => automationColumn(key, onRetryStatus)),
    }] : []),
    {
        id: "actions",
        // Solo el botón: el encabezado existe para lectores de pantalla, no ocupa ancho.
        header: () => <span className="sr-only">Acciones</span>,
        enableSorting: false,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <ReservationActions reservation={row.original} onDelete={onDelete} />
            </div>
        ),
    },
  ]
}

export const columns = getColumns()

