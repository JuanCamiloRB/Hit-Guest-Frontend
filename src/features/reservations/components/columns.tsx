"use client"

import { ColumnDef, Row, SortingFn } from "@tanstack/react-table"
import { Skeleton } from "@/components/ui/skeleton"
import { UNKNOWN_CHANNEL_LABEL } from "@/lib/reservation-channel"
import { cancelDetailPrefetch, startDetailPrefetch } from "../lib/detail-prefetch"
import { MoreVertical, Trash2, RefreshCw } from "lucide-react"
import { ChannelLogo } from "@/components/brand/ChannelLogo"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusPill } from "@/components/ui/status-pill"
import { Reservation } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { getReservationStatusMeta } from "./reservation-status-meta"
import { getAutomationCellMeta, getCheckinCellMeta, REPORT_LIGHTS } from "./automation-cell-meta"
import { compareText, compareDates, compareStatus, compareLight } from "./reservation-sorting"

export interface ColumnsOptions {
    onDelete?: (reservation: Reservation) => void
    /** Reintenta el semáforo de una fila cuya consulta falló. */
    onRetryStatus?: (reservation: Reservation) => void
}

/** Column headers for the per-automation status columns. */
const AUTOMATION_HEADERS = {
    link: "Link",
    checkin: "Check-in",
    contract: "Contrato",
    code: "Acceso",
} as const

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

/**
 * La consulta del semáforo de la fila falló: «No disponible», nunca «—» (que
 * significa «no configurada»). Una sola consulta trae todas las luces de la
 * fila, así que el reintento va solo en la primera columna.
 */
function StatusUnavailable({ reservation, onRetry }: { reservation?: Reservation; onRetry?: (reservation: Reservation) => void }) {
    if (!reservation || !onRetry) return <StatusPill tone="idle">No disponible</StatusPill>
    // La misma píldora que las demás celdas, dentro de un botón: se ven iguales
    // y el reintento no duplica estilos.
    return (
        <button
            type="button"
            onClick={() => onRetry(reservation)}
            // El nombre empieza por lo que se ve (WCAG 2.5.3): «No disponible».
            aria-label={`No disponible. Reintentar el estado de ${reservation.guestName}`}
            title="Reintentar"
            className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <StatusPill tone="idle">
                No disponible
                <RefreshCw className="h-3 w-3" aria-hidden />
            </StatusPill>
        </button>
    )
}

/**
 * El semáforo se carga por fila visible después de la lista: hasta que llega,
 * la celda dice que está cargando, nunca «—» (que significa «no configurada»).
 */
function StatusLoading() {
    // Sin `role="status"`: una región viva por celda anunciaría «cargando»
    // diez veces por página. El texto queda para quien navegue la tabla.
    return (
        <div className="inline-flex">
            <Skeleton className="h-5 w-16 rounded-full" />
            <span className="sr-only">Cargando estado</span>
        </div>
    )
}

export function getColumns(options?: ColumnsOptions): ColumnDef<Reservation>[] {
  const { onDelete, onRetryStatus } = options || {}
  return [
    {
        accessorKey: "guestName",
        header: "Huésped / Alojamiento",
        sortingFn: sortByGuest,
        cell: ({ row }) => {
            const reservation = row.original
            // Sin avatar de iniciales: repetía el nombre de al lado («H2» por
            // «Huésped 26») y hacía cada fila de 85 px. Dos líneas: quién y dónde.
            return (
                <div className="flex min-w-0 max-w-[16rem] flex-col py-0.5">
                    <Link
                        href={`/dashboard/reservations/${reservation.id}`}
                        className="truncate rounded text-sm font-semibold text-ink transition-colors hover:text-primary hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        // Quedarse sobre la fila (o enfocarla) precarga la ficha.
                        onMouseEnter={() => startDetailPrefetch(reservation.id)}
                        onMouseLeave={() => cancelDetailPrefetch(reservation.id)}
                        onFocus={() => startDetailPrefetch(reservation.id)}
                        onBlur={() => cancelDetailPrefetch(reservation.id)}
                    >
                        {reservation.guestName}
                    </Link>
                    {/* Alojamiento primero y propiedad después: el PM identifica la
                        unidad concreta, no el edificio. La propiedad queda vacía
                        mientras el portafolio no responde: sin texto que parezca un
                        fallo mientras solo está cargando. */}
                    <span className="truncate text-xs text-ink-3">
                        <span className="text-ink-2">{reservation.unitName}</span>
                        {reservation.propertyName && reservation.unitName !== reservation.propertyName && (
                            <> · {reservation.propertyName}</>
                        )}
                    </span>
                </div>
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
            // Logo real de la marca (simple-icons), el mismo de las demás pantallas.
            const icon = <ChannelLogo channel={sourceSlug ?? source} className="h-4 w-4" />
            return (
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm text-ink-2">{source}</span>
                </div>
            )
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
    // Una columna por automatización, en vez de una celda de ~700px con siete
    // pastillas en mayúsculas compitiendo con el mismo peso. Cada encabezado
    // nombra la automatización y cada pastilla dice qué le pasó.
    ...(["link", "checkin", "contract", "code"] as const).map((key) => ({
        id: key,
        header: AUTOMATION_HEADERS[key],
        // Sin `accessorFn` esto sería una display column, y TanStack le da
        // `getCanSort() === false` porque no hay valor que ordenar: el
        // encabezado se quedaría sin control de orden.
        // Sin semáforo (cargando o fallido) no hay valor: `sortUndefined: "last"`
        // lo deja al final en los dos sentidos, nunca mezclado con «—».
        // `ForSort`: mientras se completa un orden, el valor de cuando empezó.
        accessorFn: (row: Reservation) => row.automationStatusForSort?.[key],
        sortUndefined: "last" as const,
        // TanStack decide la primera dirección mirando el valor de la primera
        // fila; sin semáforo todavía sería `undefined` y empezaría al revés.
        sortDescFirst: false,
        // Ordena por severidad, no por el texto de la pastilla: pulsar CONTRATO
        // responde "¿cuáles me faltan por firmar?" y sube esos al principio.
        sortingFn: ((a: Row<Reservation>, b: Row<Reservation>) =>
            compareLight(key, a.original.automationStatusForSort, b.original.automationStatusForSort)) as SortingFn<Reservation>,
        cell: ({ row }: { row: Row<Reservation> }) => {
            const res = row.original
            if (res.automationStatusFailed) {
                return key === "link"
                    ? <StatusUnavailable reservation={res} onRetry={onRetryStatus} />
                    : <StatusUnavailable />
            }
            if (res.automationStatus === undefined) return <StatusLoading />
            // CHECK-IN dice cuántos huéspedes TERMINARON su check-in ("1 de 3
            // completados") — solo ese eje, por decisión de producto (2026-08-21):
            // la verificación de identidad se mira en el detalle, no en la lista.
            // El resto de columnas solo tienen un estado que mostrar.
            const { tone, label } = key === "checkin"
                ? getCheckinCellMeta(res.automationStatus, {
                    completed: res.completedGuests ?? null,
                    total: res.totalGuests ?? 0,
                })
                : getAutomationCellMeta(key, res.automationStatus)
            return <StatusPill tone={tone}>{label}</StatusPill>
        },
    })),
    {
        id: "reports",
        header: "Reportes",
        // Tres luces distintas en una celda: no hay un único criterio por el
        // que ordenarla, así que no se ofrece el control.
        enableSorting: false,
        cell: ({ row }) => {
            const status = row.original.automationStatus
            if (row.original.automationStatusFailed) return <StatusUnavailable />
            if (status === undefined) return <StatusLoading />
            return (
                // En una línea: apiladas, las tres pastillas hacían cada fila de 85 px.
                // La tabla ya tiene su propio scroll horizontal.
                <div className="flex flex-nowrap items-center gap-1">
                    {REPORT_LIGHTS.map(({ key, short }) => {
                        const { tone } = getAutomationCellMeta(key, status)
                        return (
                            // Sin reporte la pastilla sigue diciendo cuál es («TRA»):
                            // es texto real, no el guion decorativo de `ink-4`
                            // (2,35:1), así que va en `ink-3` (AA).
                            <StatusPill key={key} tone={tone} emptyLabel={short} className={tone === "none" ? "text-ink-3" : undefined}>
                                {short}
                            </StatusPill>
                        )
                    })}
                </div>
            )
        },
    },
    {
        id: "actions",
        header: () => <div className="text-center">Acciones</div>,
        enableSorting: false,
        cell: ({ row }) => {
            const reservation = row.original

            return (
                <div className="flex justify-center min-w-[100px]">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Acciones de la reserva de ${reservation.guestName}`}
                                className="text-ink-4 hover:text-primary"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        },
    },
  ]
}

export const columns = getColumns()

