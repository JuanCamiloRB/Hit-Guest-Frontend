"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Copy, FileText, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { StatusPill } from "@/components/ui/status-pill"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { ApiError } from "@/types/api"
import { useAuthStore } from "@/lib/store/auth-store"
import { usePortfolio } from "@/features/properties/hooks/usePortfolio"
import { icalFeedService } from "../services/ical-feed-service"
import { AIRBNB_SOURCE_PMS_ID, extractAirbnbListingId } from "../lib/ical"
import type { IcalFeed, IcalMessageTemplate } from "../types/ical"

const FEED_ACTIVE = 6
const FEED_INACTIVE = 7

/** Primer mensaje de un envelope Laravel para una clave de campo. */
function fieldError(errors: ApiError["errors"], key: string): string | null {
    if (!errors || Array.isArray(errors)) return null
    const value = (errors as Record<string, string[]>)[key]
    return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
}

/**
 * Calendarios de Airbnb por listing (contrato 2026-09-04). El feed solo trae
 * fechas + identificador: el email nunca llega (el link viaja por la mensajería
 * de Airbnb — ver la plantilla), la ocupación la declara el huésped y el precio
 * lo registra el PM en la reserva.
 */
export function AirbnbIcalPanel() {
    const userUuid = useAuthStore((s) => s.user?.uuid)
    const { listings, isLoading: loadingListings } = usePortfolio()

    const [feeds, setFeeds] = useState<IcalFeed[] | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [template, setTemplate] = useState<{ feed: IcalFeed; data: IcalMessageTemplate } | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<IcalFeed | null>(null)
    const [busyUuid, setBusyUuid] = useState<string | null>(null)
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const listingName = useCallback(
        (uuid: string) => listings.find((l) => String(l.uuid) === uuid)?.name ?? uuid.slice(0, 8),
        [listings],
    )

    const loadFeeds = useCallback(async () => {
        // Ningún setState síncrono: todos ocurren tras el await (regla
        // set-state-in-effect del repo — este callback corre desde un efecto).
        try {
            const list = await icalFeedService.list()
            setFeeds(list)
            setLoadError(false)
        } catch (error) {
            console.error("[AirbnbIcalPanel] no se pudieron cargar los feeds:", error)
            setLoadError(true)
            setFeeds([])
        }
    }, [])

    // Carga inicial con su función interna (mismo patrón que GuestDocumentsCard):
    // el linter del repo no permite invocar sincrónicamente un callback con
    // setState desde el cuerpo del efecto.
    useEffect(() => {
        let active = true
        async function initialLoad() {
            try {
                const list = await icalFeedService.list()
                if (!active) return
                setFeeds(list)
                setLoadError(false)
            } catch (error) {
                console.error("[AirbnbIcalPanel] no se pudieron cargar los feeds:", error)
                if (!active) return
                setLoadError(true)
                setFeeds([])
            }
        }
        void initialLoad()
        return () => {
            active = false
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        }
    }, [])

    /** El sync responde 202 (encolado): se refresca unos segundos después. */
    const scheduleRefresh = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => { void loadFeeds() }, 5000)
    }, [loadFeeds])

    const handleSync = async (feed: IcalFeed) => {
        setBusyUuid(feed.uuid)
        try {
            await icalFeedService.sync(feed.uuid)
            toast.success("Sincronización encolada", {
                description: "Las reservas nuevas aparecerán en unos segundos.",
            })
            scheduleRefresh()
        } catch (error) {
            console.error("[AirbnbIcalPanel] sync:", error)
            toast.error("No se pudo encolar la sincronización. Inténtalo de nuevo.")
        } finally {
            setBusyUuid(null)
        }
    }

    const handleToggle = async (feed: IcalFeed, active: boolean) => {
        setBusyUuid(feed.uuid)
        try {
            const updated = await icalFeedService.update(feed.uuid, {
                statusRecordId: active ? FEED_ACTIVE : FEED_INACTIVE,
            })
            setFeeds((prev) => prev?.map((f) => (f.uuid === feed.uuid ? updated : f)) ?? prev)
        } catch (error) {
            console.error("[AirbnbIcalPanel] toggle:", error)
            toast.error("No se pudo cambiar el estado del calendario.")
        } finally {
            setBusyUuid(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setBusyUuid(deleteTarget.uuid)
        try {
            await icalFeedService.remove(deleteTarget.uuid)
            setFeeds((prev) => prev?.filter((f) => f.uuid !== deleteTarget.uuid) ?? prev)
            toast.success("Calendario eliminado", {
                description: "Las reservas ya importadas se conservan.",
            })
        } catch (error) {
            console.error("[AirbnbIcalPanel] delete:", error)
            toast.error("No se pudo eliminar el calendario.")
        } finally {
            setBusyUuid(null)
            setDeleteTarget(null)
        }
    }

    const openTemplate = async (feed: IcalFeed) => {
        setBusyUuid(feed.uuid)
        try {
            setTemplate({ feed, data: await icalFeedService.messageTemplate(feed.uuid) })
        } catch (error) {
            console.error("[AirbnbIcalPanel] template:", error)
            toast.error("No se pudo cargar la plantilla del mensaje.")
        } finally {
            setBusyUuid(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-500">
                    Conecta el calendario iCal de cada anuncio. El calendario solo trae fechas y el
                    código de la reserva: el link de check-in le llega al huésped por la mensajería
                    de Airbnb con la plantilla de mensaje de cada calendario.
                </p>
                <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> Agregar calendario
                </Button>
            </div>

            {feeds === null ? (
                <LoadingState rows={2} label="Cargando calendarios" />
            ) : loadError ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span>No se pudieron cargar los calendarios.</span>
                    <button type="button" onClick={() => void loadFeeds()} className="font-semibold underline underline-offset-2">
                        Reintentar
                    </button>
                </div>
            ) : feeds.length === 0 ? (
                <EmptyState
                    title="Todavía no hay calendarios conectados"
                    description="Agrega la URL iCal de tu anuncio de Airbnb y las reservas empezarán a importarse en segundos."
                />
            ) : (
                <ul className="space-y-2">
                    {feeds.map((feed) => (
                        <li key={feed.uuid} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{listingName(feed.listingUuid)}</p>
                                    <p className="max-w-md truncate text-xs text-slate-400">{feed.icalUrl}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <FeedHealth feed={feed} />
                                    <Switch
                                        checked={feed.statusRecordId === FEED_ACTIVE}
                                        disabled={busyUuid === feed.uuid}
                                        onCheckedChange={(checked) => void handleToggle(feed, checked)}
                                        aria-label="Calendario activo"
                                    />
                                </div>
                            </div>
                            {feed.lastSyncError !== null && (
                                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                    <span className="break-words">{feed.lastSyncError}</span>
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                                <button
                                    type="button"
                                    disabled={busyUuid === feed.uuid}
                                    onClick={() => void openTemplate(feed)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand-purple)] hover:underline disabled:opacity-50"
                                >
                                    <FileText size={13} /> Plantilla de mensaje
                                </button>
                                <button
                                    type="button"
                                    disabled={busyUuid === feed.uuid}
                                    onClick={() => void handleSync(feed)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                                >
                                    <RefreshCw size={13} /> Sincronizar ahora
                                </button>
                                <button
                                    type="button"
                                    disabled={busyUuid === feed.uuid}
                                    onClick={() => setDeleteTarget(feed)}
                                    className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
                                >
                                    <Trash2 size={13} /> Eliminar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <CreateFeedDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                listings={listings.map((l) => ({ uuid: String(l.uuid), name: l.name }))}
                loadingListings={loadingListings}
                userUuid={userUuid}
                onCreated={(feed) => {
                    setFeeds((prev) => [...(prev ?? []), feed])
                    setCreateOpen(false)
                    toast.success("Calendario conectado", {
                        description: "Disparamos la primera sincronización: las reservas aparecen en segundos.",
                    })
                    scheduleRefresh()
                    // El siguiente paso es el que decide que el huésped reciba el link.
                    void openTemplate(feed)
                }}
            />

            {template && <TemplateDialog template={template} onClose={() => setTemplate(null)} />}

            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>¿Eliminar este calendario?</DialogTitle>
                        <DialogDescription>
                            Se dejará de sincronizar {deleteTarget ? listingName(deleteTarget.listingUuid) : ""} con
                            Airbnb. Las reservas ya importadas <strong>se conservan</strong> — eliminar el
                            calendario nunca deshace lo sincronizado.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void handleDelete()}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

/**
 * `lastSyncError` es lo único que distingue "este listing no tiene reservas" de
 * "llevamos horas sin poder leer el calendario": un feed revocado se ve idéntico
 * a uno vacío si no se muestra.
 */
function FeedHealth({ feed }: { feed: IcalFeed }) {
    if (feed.lastSyncError !== null) {
        return <StatusPill tone="warning">Con errores</StatusPill>
    }
    if (feed.lastSyncedAt === null) {
        return <StatusPill tone="idle">Nunca sincronizado</StatusPill>
    }
    const when = new Date(feed.lastSyncedAt)
    const label = Number.isNaN(when.getTime())
        ? "Sincronizado"
        : `Sincronizado ${formatDistanceToNow(when, { addSuffix: true, locale: es })}`
    return <StatusPill tone="success">{label}</StatusPill>
}

function CreateFeedDialog({
    open,
    onClose,
    listings,
    loadingListings,
    userUuid,
    onCreated,
}: {
    open: boolean
    onClose: () => void
    listings: { uuid: string; name: string }[]
    loadingListings: boolean
    userUuid: string | undefined
    onCreated: (feed: IcalFeed) => void
}) {
    const [listingUuid, setListingUuid] = useState("")
    const [icalUrl, setIcalUrl] = useState("")
    const [externalListingId, setExternalListingId] = useState("")
    const [idTouched, setIdTouched] = useState(false)
    const [errors, setErrors] = useState<{ icalUrl?: string; externalListingId?: string }>({})
    const [needsIntegration, setNeedsIntegration] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [connecting, setConnecting] = useState(false)

    const canSubmit = listingUuid !== "" && icalUrl.trim() !== "" && externalListingId.trim() !== ""

    const handleUrlChange = (value: string) => {
        setIcalUrl(value)
        // Autocompletar el ID desde la URL evita el 422 más probable; queda editable.
        if (!idTouched) {
            const extracted = extractAirbnbListingId(value)
            if (extracted) setExternalListingId(extracted)
        }
    }

    const submit = async () => {
        setSubmitting(true)
        setErrors({})
        setNeedsIntegration(null)
        try {
            const feed = await icalFeedService.create({
                listingUuid,
                sourcePmsId: AIRBNB_SOURCE_PMS_ID,
                icalUrl: icalUrl.trim(),
                externalListingId: externalListingId.trim(),
            })
            setListingUuid(""); setIcalUrl(""); setExternalListingId(""); setIdTouched(false)
            onCreated(feed)
        } catch (raw) {
            if (raw instanceof ApiError && raw.status === 422) {
                const icalUrlError = fieldError(raw.errors, "icalUrl")
                const idError = fieldError(raw.errors, "externalListingId")
                if (icalUrlError || idError) {
                    setErrors({ icalUrl: icalUrlError ?? undefined, externalListingId: idError ?? undefined })
                } else {
                    // 422 con message solo: la integración no está conectada todavía.
                    setNeedsIntegration(raw.message || "Conecta la integración Airbnb iCal antes de agregar calendarios.")
                }
            } else {
                console.error("[AirbnbIcalPanel] create:", raw)
                toast.error("No se pudo conectar el calendario. Inténtalo de nuevo.")
            }
        } finally {
            setSubmitting(false)
        }
    }

    const connectAndRetry = async () => {
        if (!userUuid) {
            toast.error("No encontramos tu usuario. Vuelve a iniciar sesión.")
            return
        }
        setConnecting(true)
        try {
            await icalFeedService.connectAirbnb(userUuid)
            setNeedsIntegration(null)
            await submit()
        } catch (error) {
            console.error("[AirbnbIcalPanel] connect:", error)
            toast.error(error instanceof Error ? error.message : "No se pudo conectar la integración.")
        } finally {
            setConnecting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next && !submitting) onClose() }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Conectar calendario de Airbnb</DialogTitle>
                    <DialogDescription>
                        En Airbnb: <strong>Calendario → Disponibilidad → Sincronizar calendarios →
                        Exportar calendario</strong>. Copia el enlace que termina en <code>.ics</code>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    <div className="space-y-1.5">
                        <Label htmlFor="ical-listing">Alojamiento en HIT Guest</Label>
                        <Select value={listingUuid} onValueChange={setListingUuid}>
                            <SelectTrigger id="ical-listing">
                                <SelectValue placeholder={loadingListings ? "Cargando…" : "Selecciona el alojamiento"} />
                            </SelectTrigger>
                            <SelectContent>
                                {listings.map((l) => (
                                    <SelectItem key={l.uuid} value={l.uuid}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="ical-url">URL del calendario (.ics)</Label>
                        <Input
                            id="ical-url"
                            value={icalUrl}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            placeholder="https://www.airbnb.com/calendar/ical/12345678.ics?s=…"
                            aria-invalid={errors.icalUrl ? true : undefined}
                        />
                        {errors.icalUrl && <p className="text-xs text-red-500">{errors.icalUrl}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="ical-external-id">ID del anuncio en Airbnb</Label>
                        <Input
                            id="ical-external-id"
                            value={externalListingId}
                            onChange={(e) => { setIdTouched(true); setExternalListingId(e.target.value.replace(/\D/g, "")) }}
                            placeholder="12345678"
                            inputMode="numeric"
                            aria-invalid={errors.externalListingId ? true : undefined}
                        />
                        <p className="text-xs text-slate-400">
                            Son los dígitos dentro del enlace del calendario, y los mismos de la URL
                            pública del anuncio (airbnb.com/rooms/<strong>12345678</strong>).
                        </p>
                        {errors.externalListingId && (
                            /* No es un detalle de validación: es la defensa contra pegar el
                               calendario de OTRO apartamento e importar reservas ajenas. */
                            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                                {errors.externalListingId} Verifica que la URL y el ID sean del mismo
                                anuncio: con el calendario equivocado importarías las reservas de otro
                                alojamiento.
                            </p>
                        )}
                    </div>

                    {needsIntegration && (
                        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <p>{needsIntegration}</p>
                            <Button size="sm" variant="outline" disabled={connecting} onClick={() => void connectAndRetry()}>
                                {connecting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                Conectar Airbnb iCal ahora
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                    <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>
                        {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        Conectar calendario
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/**
 * El paso del que depende que el huésped reciba el link: HIT no tiene su email,
 * así que el mensaje viaja programado desde el propio Airbnb del PM.
 */
function TemplateDialog({
    template,
    onClose,
}: {
    template: { feed: IcalFeed; data: IcalMessageTemplate }
    onClose: () => void
}) {
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(template.data.message)
            toast.success("Mensaje copiado")
        } catch {
            toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.")
        }
    }

    return (
        <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Mensaje programado para Airbnb</DialogTitle>
                    <DialogDescription>
                        Pega este mensaje como <strong>mensaje programado</strong> en tu anuncio de
                        Airbnb: es la única forma de que el huésped reciba su link de check-in
                        (Airbnb no nos comparte su correo).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700">
                        {template.data.message}
                    </pre>
                    {/* El mensaje va en el idioma configurado para los huéspedes de la
                        property; puede no coincidir con el idioma del panel y ESO ES
                        CORRECTO — sin este aviso, el PM lo "corrige" a mano. */}
                    <p className="text-xs text-slate-400">
                        El mensaje va en el idioma configurado para tus huéspedes — puede no coincidir
                        con el idioma en que ves este panel. No modifiques la URL.
                    </p>
                    <Button size="sm" className="gap-1.5" onClick={() => void copy()}>
                        <Copy className="h-3.5 w-3.5" /> Copiar mensaje
                    </Button>

                    <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <p>{template.data.instructions}</p>
                        <p className="font-semibold text-amber-700">
                            ⚠️ «[código de confirmación]» no es texto literal: reemplázalo con el menú
                            Shortcodes del editor de Airbnb, o el link no funcionará para nadie.
                        </p>
                        <p className="font-semibold text-amber-700">
                            ⚠️ Programa el mensaje al menos 1 hora después de la reserva: leemos el
                            calendario cada 30 minutos y un mensaje inmediato llegaría antes que la
                            reserva.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
