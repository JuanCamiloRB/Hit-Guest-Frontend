"use client"

import { ChannelLogo } from "@/components/brand/ChannelLogo"
import { Reservation } from "@/types"
import { getColumns } from "./columns"
import { consumptionService } from "@/features/billing/services/consumption-service"
import { formatUsd } from "@/features/billing/types"
import { DEFAULT_SORTING } from "./reservation-sorting"
import type { OnChangeFn, SortingState } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, isValid, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { reservationsService } from "../services/reservations-service"
import { useAutomationStatusLoader, type StatusSnapshot } from "../hooks/useAutomationStatusLoader"
import { reservationsCache, useReservations } from "../hooks/useReservations"
import { UNKNOWN_CHANNEL_LABEL } from "@/lib/reservation-channel"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import { normalizeApiError, notifyError } from "@/lib/notify-error"

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
    ABANDONED: "Abandonada",
    INCOMPLETE: "Incompleta",
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
    "ABANDONED",
    "INCOMPLETE",
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
import { FeedbackBanner } from "@/components/ui/feedback-banner"



/** Columnas que ordenan por el semáforo: necesitan el de todas las filas antes de ordenar. */
const STATUS_SORT_COLUMNS = new Set(["link", "checkin", "contract", "code"])
/** `some`, no solo el primero: el orden múltiple (shift + clic) también cuenta. */
const hasStatusSort = (sorting: SortingState) => sorting.some((s) => STATUS_SORT_COLUMNS.has(s.id))

/** Valor del filtro de origen para las reservas sin canal informado. */
const NO_SOURCE = "__sin_origen__"

/** Identidad de fila para la tabla: por uuid, no por posición. */
const rowId = (reservation: Reservation) => reservation.id
export default function ReservationsList() {
    // La lista compartida: al volver se ve la anterior mientras se refresca.
    const { reservations: loaded, status, syncing, refreshFailed, version, refresh } = useReservations()
    const reservations = useMemo(() => loaded ?? [], [loaded])
    // El semáforo llega aparte de la lista y solo para lo necesario: lo visible
    // primero, la página siguiente detrás, todo solo al ordenar por estado.
    const { prioritize, prefetch, renew, retry: retryStatus, ensure, withStatus, settledCount, snapshot } = useAutomationStatusLoader()
    const visibleRowsRef = useRef<Reservation[]>([])
    const nextRowsRef = useRef<Reservation[]>([])
    const handleVisibleRows = useCallback((visible: Reservation[], next: Reservation[]) => {
        visibleRowsRef.current = visible
        nextRowsRef.current = next
        prioritize(visible)
        prefetch(next)
    }, [prioritize, prefetch])
    // Un refresco de la lista (no la primera carga, ni un `patch` local)
    // renueva el semáforo de lo que se ve: un huésped pudo completar su check-in.
    useEffect(() => {
        if (version > 1) renew(visibleRowsRef.current)
    }, [version, renew])
    useEffect(() => {
        if (syncing) toast.info("Sincronización en progreso", { description: "Las reservas se actualizarán en unos segundos." })
    }, [syncing])
    const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    // Candado síncrono contra el doble clic (el estado llega un render tarde).
    const deleteLockRef = useRef(false)
    /**
     * Consumo facturado de la reserva que se está por eliminar, con el id al que
     * pertenece (se deriva en render: sin id coincidente no se muestra — así no
     * hace falta resetear estado al abrir/cerrar el diálogo).
     *
     * Hoy eliminar una reserva la saca también del tablero de saldos (el tablero
     * se arma desde GET /reservations); mientras backend define cómo conservar
     * esa contabilidad, lo mínimo es que el PM lo sepa ANTES de confirmar.
     */
    const [deleteConsumption, setDeleteConsumption] = useState<
        | { forId: string; requestToken: object; status: "loading" }
        | { forId: string; requestToken: object; status: "ready"; total: number }
        | { forId: string; requestToken: object; status: "error" }
        | null
    >(null)

    const loadDeleteConsumption = useCallback((reservation: Reservation) => {
        const requestToken = {}
        setDeleteConsumption({ forId: reservation.id, requestToken, status: "loading" })
        void consumptionService
            .getReservationCost(reservation)
            .then((cost) => {
                setDeleteConsumption((current) =>
                    current?.forId === reservation.id && current.requestToken === requestToken
                        ? { forId: reservation.id, requestToken, status: "ready", total: cost.total }
                        : current,
                )
            })
            .catch(() => {
                setDeleteConsumption((current) =>
                    current?.forId === reservation.id && current.requestToken === requestToken
                        ? { forId: reservation.id, requestToken, status: "error" }
                        : current,
                )
            })
    }, [])

    const requestDelete = useCallback((reservation: Reservation) => {
        setDeleteTarget(reservation)
        loadDeleteConsumption(reservation)
    }, [loadDeleteConsumption])

    const deleteConsumptionState =
        deleteTarget && deleteConsumption?.forId === deleteTarget.id ? deleteConsumption : null
    const deleteTargetConsumption =
        deleteConsumptionState?.status === "ready" ? deleteConsumptionState.total : null
    const consumptionResolved = deleteConsumptionState?.status === "ready"

    // ── Filters (client-side over the loaded reservations) ──
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<"ALL" | Reservation["status"]>("ALL")
    // "ALL" o el nombre real de un canal presente en la cuenta.
    const [sourceFilter, setSourceFilter] = useState<string>("ALL")
    // Date-range filter: pick the column (check-in / checkout) and a from–to range.
    const [dateField, setDateField] = useState<DateField>("checkIn")
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

    // Offer the core reservation states always, plus any others present in the data.
    const statusOptions = useMemo(
        () => Array.from(new Set([...CORE_STATUSES, ...reservations.map((r) => r.status)])),
        [reservations],
    )
    // Canales presentes en la cuenta, con su slug para el logo (el mismo que la
    // columna: un canal renombrado conserva su marca). Sin canal, opción aparte.
    const sourceOptions = useMemo(() => {
        const slugByName = new Map<string, string | null>()
        for (const r of reservations) {
            if (r.source && !slugByName.has(r.source)) slugByName.set(r.source, r.sourceSlug ?? null)
        }
        return Array.from(slugByName, ([name, slug]) => ({ name, slug })).sort((a, b) => a.name.localeCompare(b.name, "es"))
    }, [reservations])
    const hasUnknownSource = useMemo(() => reservations.some((r) => !r.source), [reservations])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        // Normalize the date range once (inclusive of whole days). A range with only
        // `from` selected filters that single day.
        const rangeStart = dateRange?.from ? startOfDay(dateRange.from) : null
        const rangeEnd = dateRange?.from ? endOfDay(dateRange.to ?? dateRange.from) : null
        return reservations.filter((r) => {
            if (statusFilter !== "ALL" && r.status !== statusFilter) return false
            if (sourceFilter === NO_SOURCE ? !!r.source : sourceFilter !== "ALL" && r.source !== sourceFilter) return false
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
        if (!deleteTarget || deleteLockRef.current || deleteConsumptionState?.status !== "ready") return
        deleteLockRef.current = true
        setIsDeleting(true)
        try {
            await reservationsService.delete(deleteTarget.id)
            // El servidor ya confirmó: la fila desaparece en el acto para todos
            // los que miran la lista, sin volver a pedirla.
            reservationsCache.patch((list) => list.filter((r) => r.id !== deleteTarget.id))
            toast.success("Reserva eliminada correctamente")
            setDeleteTarget(null)
        } catch (error) {
            if (normalizeApiError(error).status === 404) {
                // Ya no está (otra persona la eliminó, por ejemplo): reintentar
                // fallaría siempre. Se cierra y se relee la lista del servidor,
                // que decide; no se da por eliminada en el front.
                toast.info("Esta reserva ya no existe. Actualizamos la lista.")
                setDeleteTarget(null)
                refresh()
                return
            }
            // Cualquier otro fallo: el diálogo sigue abierto para reintentar o cancelar.
            console.error("Failed to delete reservation:", error)
            notifyError(error, "Error al eliminar la reserva")
        } finally {
            deleteLockRef.current = false
            setIsDeleting(false)
        }
    }

    const columns = useMemo(
        () => getColumns({ onDelete: requestDelete, onRetryStatus: retryStatus }),
        [requestDelete, retryStatus]
    )
    // Ordenar por una columna de estado necesita el semáforo de TODAS las filas
    // del filtro. Con datos a medias el orden sería falso, así que mientras
    // falten se «prepara»: se piden y la tabla sigue con el último orden
    // completo. El resto de columnas, al instante.
    //
    // - `sorting`: lo que pidió el usuario.
    // - `shown`: lo que la tabla muestra (el último orden completo), la foto de
    //   valores con que se ordena mientras se prepara, y el último orden sin
    //   columnas de estado (a donde vuelve «Cancelar orden»).
    const [sorting, setSorting] = useState<SortingState>(() => [...DEFAULT_SORTING])
    const [shown, setShown] = useState<{ sorting: SortingState; frozen: StatusSnapshot | null; lastPlain: SortingState }>(
        () => ({ sorting, frozen: null, lastPlain: sorting }),
    )
    const settled = settledCount(filtered)
    // Un fallo cuenta como resultado: queda al final, con su aviso.
    const preparing = hasStatusSort(sorting) && settled < filtered.length
    if (!preparing && (shown.sorting !== sorting || shown.frozen)) {
        // Completo: se aplica una sola vez, con los valores actuales.
        setShown({ sorting, frozen: null, lastPlain: hasStatusSort(sorting) ? shown.lastPlain : sorting })
    } else if (preparing && hasStatusSort(shown.sorting) && !shown.frozen) {
        // El conjunto ordenado por estado creció (otro filtro, una reserva
        // nueva): se ordena con lo que se sabía; lo nuevo, estable al final.
        setShown({ ...shown, frozen: snapshot })
    }
    const tableSorting = preparing ? shown.sorting : sorting
    const sortValues = preparing ? shown.frozen : null
    const rows = useMemo(() => withStatus(filtered, sortValues), [filtered, sortValues, withStatus])

    // La carga de lo que falta, para el conjunto MÁS RECIENTE: si el filtro
    // cambia en medio, la limpieza retira lo que la anterior dejó esperando
    // (lo en vuelo termina) y se prepara la nueva. Lo visible y la página
    // siguiente se vuelven a pedir: la preparación los había adelantado en la
    // misma cola.
    const preparingRows = preparing ? filtered : null
    useEffect(() => {
        if (!preparingRows) return
        const preparation = ensure(preparingRows)
        return () => {
            preparation.cancel()
            // Después del commit: si cambió el filtro, la tabla ya avisó cuáles
            // son las filas visibles NUEVAS (no se piden las que quedaron fuera).
            queueMicrotask(() => {
                prioritize(visibleRowsRef.current)
                prefetch(nextRowsRef.current)
            })
        }
    }, [preparingRows, ensure, prioritize, prefetch])

    // En vivo, no guardado: si una fila se reintenta con éxito, deja de contar.
    const failedInStatusSort = !preparing && hasStatusSort(tableSorting)
        ? rows.filter((r) => r.automationStatusFailed).length
        : 0
    // Nunca queda un orden por estado que se sabe incompleto: vuelve al último
    // orden sin columnas de estado (normalmente, por fecha de entrada).
    const cancelPreparingSort = () => setSorting(shown.lastPlain)
    // Gana siempre el último pedido; relativo a lo que se ve.
    const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
        setSorting(typeof updater === "function" ? updater(tableSorting) : updater)
    }


    if (status === "loading") {
        // Esqueletos con la forma de las filas que vienen: la tabla no salta
        // cuando llegan los datos, y se ve qué se está cargando.
        return (
            <div className="rounded-xl border border-rule bg-white">
                <LoadingState rows={6} label="Cargando reservaciones" />
            </div>
        )
    }

    if (status === "error") {
        // Sin lista no hay nada que filtrar: un fallo se dice, no se muestra
        // como «no hay reservas».
        return (
            <div className="rounded-xl border border-rule bg-white">
                <EmptyState
                    title={syncing ? "Las reservas se están sincronizando" : "No pudimos cargar las reservas"}
                    description={syncing ? "Intenta nuevamente en unos segundos." : "Revisa tu conexión e intenta de nuevo."}
                    action={<Button variant="outline" size="sm" onClick={refresh}>Reintentar</Button>}
                />
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
                    <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filtrar por estado">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los estados</SelectItem>
                        {statusOptions.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filtrar por origen">
                        <SelectValue placeholder="Origen" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los orígenes</SelectItem>
                        {sourceOptions.map(({ name, slug }) => (
                            <SelectItem key={name} value={name}>
                                <span className="flex items-center gap-2">
                                    <ChannelLogo channel={slug ?? name} className="h-4 w-4" />
                                    {name}
                                </span>
                            </SelectItem>
                        ))}
                        {hasUnknownSource && <SelectItem value={NO_SOURCE}>{UNKNOWN_CHANNEL_LABEL}</SelectItem>}
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

            {refreshFailed && (
                // Mismo aviso que el Tablero: la lista sigue a la vista, pero puede no ser la actual.
                <FeedbackBanner
                    tone="warning"
                    mode="dynamic"
                    action={<Button type="button" size="sm" variant="outline" onClick={refresh}>Reintentar</Button>}
                >
                    No pudimos actualizar la lista. Se muestra la última cargada.
                </FeedbackBanner>
            )}

            {preparing ? (
                <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sunk px-3 py-2 text-[13px] text-ink-2">
                    <span>Preparando todos los estados para ordenar… {settled} de {filtered.length}</span>
                    <button type="button" onClick={cancelPreparingSort} className="text-[13px] font-semibold text-primary underline-offset-2 hover:underline">
                        Cancelar orden
                    </button>
                </div>
            ) : failedInStatusSort > 0 ? (
                <FeedbackBanner tone="warning" mode="dynamic">
                    No se pudo cargar el estado de {failedInStatusSort} {failedInStatusSort === 1 ? "reserva" : "reservas"}: {failedInStatusSort === 1 ? "queda" : "quedan"} al final del orden.
                </FeedbackBanner>
            ) : null}

            <DataTable
                columns={columns}
                data={rows}
                sorting={tableSorting}
                onSortingChange={handleSortingChange}
                getRowId={rowId}
                onVisibleRowsChange={handleVisibleRows}
            />

            {/* Mientras se elimina no se cierra: el resultado tiene que verse. */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
                        {/* `asChild` + div: los avisos son bloques y la descripción es un
                            <p> por defecto (un div dentro de un p es HTML inválido). Siguen
                            dentro de la descripción: se leen al abrir el diálogo. */}
                        <AlertDialogDescription asChild>
                            <div>
                                <p>
                                    Estás a punto de eliminar la reserva de <strong>{deleteTarget?.guestName}</strong>.
                                    Esta acción no se puede deshacer.
                                </p>
                                {deleteConsumptionState?.status === "loading" && (
                                    <p role="status" className="mt-2 rounded-lg bg-sunk px-3 py-2 text-ink-2">
                                        Verificando el consumo registrado…
                                    </p>
                                )}
                                {deleteConsumptionState?.status === "error" && (
                                    <FeedbackBanner tone="danger" mode="blocking" className="mt-2">
                                        No pudimos verificar el consumo de esta reserva. Reintenta la consulta antes de eliminarla.
                                    </FeedbackBanner>
                                )}
                                {deleteTargetConsumption !== null && deleteTargetConsumption > 0 && (
                                    <FeedbackBanner tone="warning" className="mt-2">
                                        Esta reserva tiene consumo registrado por{" "}
                                        <strong className="text-ink">{formatUsd(deleteTargetConsumption)}</strong>. Al eliminarla,
                                        ese consumo dejará de mostrarse en el tablero de saldos.
                                    </FeedbackBanner>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        {deleteConsumptionState?.status === "error" && deleteTarget && (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isDeleting}
                                onClick={() => loadDeleteConsumption(deleteTarget)}
                            >
                                Reintentar consulta
                            </Button>
                        )}
                        {/* keepOpen: antes Radix cerraba al clic y «Eliminando…» nunca se veía. */}
                        <AlertDialogAction
                            className={buttonVariants({ variant: "destructive" })}
                            keepOpen
                            pending={isDeleting}
                            pendingLabel="Eliminando…"
                            onClick={() => void handleDelete()}
                            disabled={!consumptionResolved}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
