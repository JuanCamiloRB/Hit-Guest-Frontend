"use client"

import { ColumnDef, Row, SortingFn } from "@tanstack/react-table"
import { MoreVertical, Globe, Package2, Trash2 } from "lucide-react"
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
            let icon = <Globe className="h-4 w-4 text-slate-500" />

            if (source === "Airbnb") {
                icon = (
                    <svg viewBox="0 0 32 32" className="h-4 w-4 fill-[#FF5A5F]">
                        <path d="M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 6.114 12.54 7.1 14.836l.145.353c.667 1.591.91 2.472.96 3.396l.01.415.001.228c0 4.062-2.877 6.478-6.357 6.478-2.224 0-4.556-1.258-6.709-3.386l-.257-.26-.172-.179h-.011l-.176.185c-2.044 2.1-4.392 3.415-6.7 3.415-3.477 0-6.32-2.316-6.32-6.275 0-1.12.247-2.19.782-3.666l.241-.634c.152-.416.323-.847.514-1.291l.244-.551A134.691 134.691 0 0 1 11.249 4.2C12.536 1.933 13.991 1 16 1zm0 2c-1.398 0-2.474.722-3.532 2.58l-.138.254c-1.574 2.924-4.62 9.294-5.913 12.01l-.226.49c-.198.442-.375.885-.53 1.328l-.206.574c-.546 1.503-.78 2.623-.73 3.49l.019.23c.029 2.91 2.112 4.301 4.32 4.301 1.761 0 3.655-1.115 5.421-2.923l.422-.444.17-.184h.015l.17.185.344.364c1.83 1.906 3.791 3.002 5.673 3.002 2.376 0 4.357-1.743 4.357-4.478l-.001-.19-.009-.32c-.046-.867-.282-1.688-.891-3.13l-.151-.365c-1-2.285-5.118-10.908-7.143-14.887l-.469-.902C18.526 3.723 17.404 3 16 3zm0 10c2.761 0 5 2.239 5 5 0 2.222-1.455 4.102-3.472 4.755l-.261.076-.267.069C16.66 23.109 16.335 23 16 23s-.66.109-1 .311V23l-.117-.021A5.006 5.006 0 0 1 11 18c0-2.761 2.239-5 5-5zm0 2c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
                    </svg>
                )
            } else if (source === "Booking") {
                icon = (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#003580]">
                        <path d="M19.1 1.1H5.1C2.8 1.1 1.1 2.8 1.1 5.1v14c0 2.3 1.7 4 4 4h14c2.3 0 4-1.7 4-4v-14c0-2.3-1.9-4-4.2-4zm.1 12.8c0 1.2-.4 2.2-1.1 3-1 1-2.4 1.5-4 1.5h-5.2v-11h4.8c1.3 0 2.4.3 3.2 1 .7.6 1.1 1.4 1.1 2.5 0 1-.3 1.8-1 2.4l.2.3c1.2.3 2 1.3 2 2.6l-.2-.3zm-6.2-4.9h-1v2.1h.9c1 0 1.6-.5 1.6-1 0-.7-.6-1.1-1.5-1.1zm.4 4.5h-1.3v2.5h1.3c1 0 1.7-.5 1.7-1.3-.1-.7-.8-1.2-1.7-1.2z" />
                    </svg>
                )
            } else if (source === "Direct") {
                icon = <Package2 className="h-4 w-4 text-primary" />
            }

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
                <ReservationStatusIcon status={row.original.status} />
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
            // CHECK-IN dice cuántos huéspedes van ("1 de 3 verificados"); el
            // resto de columnas solo tienen un estado que mostrar.
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

