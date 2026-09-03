"use client"

import { Reservation } from "@/types"
import { getColumns } from "./columns"
import { consumptionService } from "@/features/billing/services/consumption-service"
import { formatUsd } from "@/features/billing/types"
import { DEFAULT_SORTING } from "./reservation-sorting"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Search, X, CalendarIcon } from "lucide-react"
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useMemo, useState } from "react"
import { format, isValid, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { reservationsService } from "../services/reservations-service"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"

/** Which date column the range filter applies to. */
type DateField = "checkIn" | "checkOut"
const DATE_FIELD_LABELS: Record<DateField, string> = {
    checkIn: "Check-in",
    checkOut: "Checkout",
}

const STATUS_LABELS: Record<Reservation["status"], string> = {
    CONFIRMED: "Confirmada",
    IN_PROGRESS: "En Progreso",
    CANCELLED: "Cancelada",
    CLOSED: "Finalizada",
    DELETED: "Eliminada",
    UNKNOWN: "Desconocido",
    PENDING: "Pendiente",
    CHECKED_IN: "Check-in",
    CHECKED_OUT: "Check-out",
    LINK_SENT: "Link enviado",
    PENDING_CONTRACT: "Contrato pendiente",
    NO_STARTED: "No iniciada",
}

// HitGuest's own reservation statuses (catalog_category_id 7), always offered in the
// filter even when absent from the loaded page. Order mirrors the catalog ids 27→109.
const CORE_STATUSES: Reservation["status"][] = [
    "CONFIRMED",
    "IN_PROGRESS",
    "CANCELLED",
    "CLOSED",
    "DELETED",
    "UNKNOWN",
]
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ReservationsList() {
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    /**
     * Consumo facturado de la reserva que se está por eliminar, con el id al que
     * pertenece (se deriva en render: sin id coincidente no se muestra — así no
     * hace falta resetear estado al abrir/cerrar el diálogo).
     *
     * Hoy eliminar una reserva la saca también del tablero de saldos (el tablero
     * se arma desde GET /reservations); mientras backend define cómo conservar
     * esa contabilidad, lo mínimo es que el PM lo sepa ANTES de confirmar.
     */
    const [deleteConsumption, setDeleteConsumption] = useState<{ forId: string; total: number } | null>(null)

    useEffect(() => {
        if (!deleteTarget) return
        let active = true
        consumptionService
            .getReservationCosts([deleteTarget])
            .then(([cost]) => {
                if (active && cost) setDeleteConsumption({ forId: deleteTarget.id, total: cost.total })
            })
            .catch(() => {
                // Sin el dato no se bloquea nada: el aviso simplemente no aparece.
            })
        return () => { active = false }
    }, [deleteTarget])

    const deleteTargetConsumption =
        deleteTarget && deleteConsumption?.forId === deleteTarget.id ? deleteConsumption.total : null

    // ── Filters (client-side over the loaded reservations) ──
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"ALL" | Reservation["status"]>("ALL")
    const [sourceFilter, setSourceFilter] = useState<"ALL" | Reservation["source"]>("ALL")
    // Date-range filter: pick the column (check-in / checkout) and a from–to range.
    const [dateField, setDateField] = useState<DateField>("checkIn")
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

    // Offer the core reservation states always, plus any others present in the data.
    const statusOptions = useMemo(
        () => Array.from(new Set([...CORE_STATUSES, ...reservations.map((r) => r.status)])),
        [reservations],
    )
    const sourceOptions = useMemo(
        () => Array.from(new Set(reservations.map((r) => r.source))),
        [reservations],
    )

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        // Normalize the date range once (inclusive of whole days). A range with only
        // `from` selected filters that single day.
        const rangeStart = dateRange?.from ? startOfDay(dateRange.from) : null
        const rangeEnd = dateRange?.from ? endOfDay(dateRange.to ?? dateRange.from) : null
        return reservations.filter((r) => {
            if (statusFilter !== "ALL" && r.status !== statusFilter) return false
            if (sourceFilter !== "ALL" && r.source !== sourceFilter) return false
            if (rangeStart && rangeEnd) {
                const d = r[dateField]
                if (!(d instanceof Date) || !isValid(d)) return false
                if (!isWithinInterval(d, { start: rangeStart, end: rangeEnd })) return false
            }
            if (!q) return true
            return [r.guestName, r.propertyName, r.unitName, r.email, r.id]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
        })
    }, [reservations, search, statusFilter, sourceFilter, dateField, dateRange])

    const hasActiveFilters =
        search.trim() !== "" || statusFilter !== "ALL" || sourceFilter !== "ALL" || !!dateRange?.from
    const clearFilters = () => {
        setSearch("")
        setStatusFilter("ALL")
        setSourceFilter("ALL")
        setDateRange(undefined)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            await reservationsService.delete(deleteTarget.id)
            setReservations((prev) => prev.filter((r) => r.id !== deleteTarget.id))
            toast.success("Reserva eliminada correctamente")
        } catch (error) {
            console.error("Failed to delete reservation:", error)
            notifyError(error, "Error al eliminar la reserva")
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    const columns = useMemo(
        () => getColumns({ onDelete: (reservation) => setDeleteTarget(reservation) }),
        []
    )

    useEffect(() => {
        const loadReservations = async () => {
            try {
                const data = await reservationsService.list()
                setReservations(data)
            } catch (error) {
                console.error("Failed to fetch reservations:", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadReservations()

        const handleReservationCreated = () => {
            setIsLoading(true)
            loadReservations()
        }

        window.addEventListener("reservationCreated", handleReservationCreated)
        return () => window.removeEventListener("reservationCreated", handleReservationCreated)
    }, [])

    if (isLoading) {
        // Esqueletos con la forma de las filas que vienen: la tabla no salta
        // cuando llegan los datos, y se ve qué se está cargando.
        return (
            <div className="rounded-xl border border-rule bg-white">
                <LoadingState rows={6} label="Cargando reservaciones" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar huésped, propiedad, correo o ID..."
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los estados</SelectItem>
                        {statusOptions.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Origen" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los orígenes</SelectItem>
                        {sourceOptions.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full sm:w-auto justify-start gap-2 font-normal",
                                !dateRange?.from && "text-slate-500"
                            )}
                        >
                            <CalendarIcon className="h-4 w-4 shrink-0" />
                            {dateRange?.from ? (
                                <span className="truncate">
                                    {DATE_FIELD_LABELS[dateField]}: {format(dateRange.from, "d MMM", { locale: es })}
                                    {dateRange.to && ` – ${format(dateRange.to, "d MMM", { locale: es })}`}
                                </span>
                            ) : (
                                "Fechas"
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        {/* Which date column the range applies to */}
                        <div className="flex gap-1 border-b border-slate-100 p-2">
                            {(Object.keys(DATE_FIELD_LABELS) as DateField[]).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setDateField(f)}
                                    className={cn(
                                        "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                                        dateField === f
                                            ? "bg-brand-purple text-white"
                                            : "text-slate-500 hover:bg-slate-100"
                                    )}
                                >
                                    {DATE_FIELD_LABELS[f]}
                                </button>
                            ))}
                        </div>
                        <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={1}
                            locale={es}
                            initialFocus
                        />
                        {dateRange?.from && (
                            <div className="border-t border-slate-100 p-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDateRange(undefined)}
                                    className="w-full text-slate-500 gap-1.5"
                                >
                                    <X className="h-4 w-4" />
                                    Quitar fechas
                                </Button>
                            </div>
                        )}
                    </PopoverContent>
                </Popover>
                {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters} className="text-slate-500 gap-1.5">
                        <X className="h-4 w-4" />
                        Limpiar
                    </Button>
                )}
            </div>

            <DataTable columns={columns} data={filtered} defaultSorting={[...DEFAULT_SORTING]} />

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar la reserva de <strong>{deleteTarget?.guestName}</strong>.
                            Esta acción no se puede deshacer.
                            {deleteTargetConsumption !== null && deleteTargetConsumption > 0 && (
                                <span className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                                    Esta reserva tiene consumo registrado por{" "}
                                    <strong>{formatUsd(deleteTargetConsumption)}</strong>. Al eliminarla,
                                    ese consumo dejará de mostrarse en el tablero de saldos.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
