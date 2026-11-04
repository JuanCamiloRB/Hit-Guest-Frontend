"use client"

import { ColumnDef, Row, SortingFn } from "@tanstack/react-table"
import { Skeleton } from "@/components/ui/skeleton"
import { MoreVertical, Trash2 } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusPill } from "@/components/ui/status-pill"
import { Reservation } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ReservationStatusIcon } from "./ReservationStatusIcon"
import { getAutomationCellMeta, getCheckinCellMeta, REPORT_LIGHTS } from "./automation-cell-meta"
import { compareText, compareDates, compareStatus, compareLight } from "./reservation-sorting"

export interface ColumnsOptions {
    onDelete?: (reservation: Reservation) => void
}

/** Column headers for the per-automation status columns. */
const AUTOMATION_HEADERS = {
    link: "LINK",
    checkin: "CHECK-IN",
    contract: "CONTRATO",
    code: "ACCESO",
} as const

// Los comparadores viven en reservation-sorting.ts (puros y testeados); aquí
// solo se adaptan a la firma que espera TanStack.
const sortByGuest: SortingFn<Reservation> = (a, b) =>
    compareText(a.original.guestName, b.original.guestName)

const sortByCheckIn: SortingFn<Reservation> = (a, b) =>
    compareDates(a.original.checkIn, b.original.checkIn)

const sortBySource: SortingFn<Reservation> = (a, b) =>
    compareText(a.original.source, b.original.source)

const sortByStatus: SortingFn<Reservation> = (a, b) =>
    compareStatus(a.original.status, b.original.status)

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
  const { onDelete } = options || {}
  return [
    {
        accessorKey: "guestName",
        header: "HUÉSPED / ALOJAMIENTO",
        sortingFn: sortByGuest,
        cell: ({ row }) => {
            const reservation = row.original
            const guestName = reservation.guestName
            const initials = guestName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)

            return (
                <div className="flex items-center gap-3 py-1">
                    <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <Link
                            href={`/dashboard/reservations/${reservation.id}`}
                            className="font-bold text-sm text-ink hover:text-primary transition-colors truncate"
                        >
                            {guestName}
                        </Link>
                        {/* Alojamiento primero y propiedad debajo: el PM identifica la
                            unidad concreta, no el edificio. */}
                        <span className="text-xs text-ink-2 truncate">
                            {reservation.unitName}
                        </span>
                        {reservation.unitName !== reservation.propertyName && (
                            <span className="text-xs text-ink-3 truncate">
                                {reservation.propertyName}
                            </span>
                        )}
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "checkIn",
        header: "FECHAS",
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
        header: "ORIGEN",
        sortingFn: sortBySource,
        cell: ({ row }) => {
            const source = row.original.source
            // Logo real de la marca (simple-icons), el mismo de las demás pantallas.
            const icon = <ChannelLogo channel={source} className="h-4 w-4" />
            return (
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-slate-700">{source}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "status",
        // Texto plano, no un <div> centrado: ahora el encabezado va dentro del
        // botón de orden, y un bloque centrado ahí dentro no centra nada.
        header: "ESTADO",
        sortingFn: sortByStatus,
        cell: ({ row }) => (
            <div className="flex">
                <ReservationStatusIcon status={row.original.status} backendLabel={row.original.statusLabel} statusId={row.original.statusId} />
            </div>
        ),
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
        accessorFn: (row: Reservation) => row.automationStatus?.[key] ?? "none",
        // Ordena por severidad, no por el texto de la pastilla: pulsar CONTRATO
        // responde "¿cuáles me faltan por firmar?" y sube esos al principio.
        sortingFn: ((a: Row<Reservation>, b: Row<Reservation>) =>
            compareLight(key, a.original.automationStatus, b.original.automationStatus)) as SortingFn<Reservation>,
        cell: ({ row }: { row: Row<Reservation> }) => {
            const res = row.original
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
        header: "REPORTES",
        // Tres luces distintas en una celda: no hay un único criterio por el
        // que ordenarla, así que no se ofrece el control.
        enableSorting: false,
        cell: ({ row }) => {
            const status = row.original.automationStatus
            if (status === undefined) return <StatusLoading />
            return (
                <div className="flex flex-wrap items-center gap-1">
                    {REPORT_LIGHTS.map(({ key, short }) => {
                        const { tone } = getAutomationCellMeta(key, status)
                        return (
                            <StatusPill key={key} tone={tone} emptyLabel={short}>
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
        header: () => <div className="text-center">ACCIONES</div>,
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
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
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

