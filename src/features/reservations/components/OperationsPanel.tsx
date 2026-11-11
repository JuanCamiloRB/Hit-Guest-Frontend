"use client"

import { useState, type ReactNode } from "react"
import { reservationsService } from "../services/reservations-service"
import { useReservationDetail } from "../hooks/useReservationDetail"
import { UNKNOWN_CHANNEL_LABEL } from "@/lib/reservation-channel"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    Printer,
    Edit,
    ChevronRight,
    Send,
    Copy,
    MessageSquare,
    Calendar,
    Home,
    FileText,
    Loader2,
    Users,
    Mail,
    Phone,
    Moon,
    type LucideIcon,
} from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { COMMUNICATION_LOCALES, LOCALE_LABELS, type CommunicationLocale } from "@/lib/locales"
import { ReservationDialog } from "./ReservationDialog"
import { RegisterPriceDialog } from "./RegisterPriceDialog"
import {
    getReservationStatusMeta,
    isReservationActionable,
    reservationChannelKind,
    formatGuestName,
    guestInitials,
} from "./reservation-status-meta"
import { AutomationStatusList } from "./automations"
import { GuestDocumentsCard } from "./GuestDocumentsCard"
import { PropertyDocumentsCard } from "./PropertyDocumentsCard"
import { CheckinLinkDeliveryCard } from "./CheckinLinkDeliveryCard"
import { useCheckinLinkChannels } from "../hooks/useCheckinLinkChannels"
import { ReservationPriceCard } from "./ReservationPriceCard"
import { hasUsablePhone, isOtaApplicable } from "../lib/checkin-link-delivery-status"
import { describeResendCharges } from "@/features/properties/lib/checkin-link-delivery"
import Link from "next/link"
import { inactiveResourceAction, readInactiveResourceError } from "@/lib/inactive-resource"
import { checkinLinkBlockedReason } from "../lib/reservation-availability"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { RefreshIndicator } from "@/components/ui/loading-state"

export function OperationsPanel({ reservationId }: { reservationId: string }) {
    // Si la fila se precargó al pasar el cursor, la ficha se ve al instante y
    // se revalida detrás; si no, esqueleto como siempre.
    const { data, status, refreshFailed, errorMessage: error, reload } = useReservationDetail(reservationId)
    const isLoading = status === "loading"
    const [isSendingLink, setIsSendingLink] = useState(false)
    const [sendDialogOpen, setSendDialogOpen] = useState(false)
    const [recipientEmail, setRecipientEmail] = useState("")
    // "default" => omit locale (use property's configured language).
    const [localeChoice, setLocaleChoice] = useState<"default" | CommunicationLocale>("default")
    const [priceDialogOpen, setPriceDialogOpen] = useState(false)
    // Por dónde sale el link de ESTA reserva (propiedad + unidad). Alimenta el
    // aviso de teléfono faltante y el costo en el diálogo de reenvío.
    const linkChannels = useCheckinLinkChannels(data?.propertyUuid ?? null, data?.listingUuid ?? null)
    const resendCharges = data
        ? describeResendCharges({
            channels: linkChannels.channels,
            whatsappUsable: hasUsablePhone(data.phone),
            otaApplicable: isOtaApplicable(data.origin),
            unitCosts: linkChannels.unitCosts,
        })
        : null


    // Prefill recipient with the main guest's email and reset the language to the
    // property default each time the dialog opens.
    const openSendDialog = (open: boolean) => {
        if (open) {
            setRecipientEmail(data?.email ?? "")
            setLocaleChoice("default")
        }
        setSendDialogOpen(open)
    }

    // `email` es OPCIONAL en el reenvío (contrato 2026-09-19 §6): omitido, el
    // backend usa el correo registrado del huésped y enruta por los canales
    // configurados. Exigirlo acá bloqueaba reenviar una reserva sin correo
    // (iCal) que sí sale por WhatsApp o por la OTA. Vacío = válido y se omite;
    // con texto, tiene que ser un correo bien formado.
    const trimmedRecipient = recipientEmail.trim()
    const isValidEmail = trimmedRecipient === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedRecipient)

    // Sends the check-in link. `email` overrides the recipient; `locale`
    // omitted ("default") means the backend uses the property's configured language.
    const handleSendCheckinLink = async () => {
        if (isSendingLink || !isValidEmail) return
        setIsSendingLink(true)
        try {
            const message = await reservationsService.sendCheckinLink(reservationId, {
                email: trimmedRecipient === "" ? undefined : trimmedRecipient,
                locale: localeChoice === "default" ? undefined : localeChoice,
            })
            toast.success(message)
            setSendDialogOpen(false)
            // La tarjeta «Link de check-in» lee `extra.checkinLink*` de la ficha:
            // sin releer, seguía diciendo «Todavía no se ha enviado» después de
            // un reenvío exitoso (reportado como «caché del front», 2026-10-08).
            reload()
        } catch (e) {
            // Alojamiento o propiedad inactivos (contrato 2026-10-27): no sale
            // ningún link. Mensaje del backend tal cual, y el camino para
            // gestionarlo (no se activa desde acá: tiene efectos en cascada).
            const inactive = readInactiveResourceError(e)
            if (inactive) {
                const manage = inactiveResourceAction(inactive, data?.propertyUuid)
                toast.error("No se pudo enviar el link de check-in", {
                    description: inactive.message,
                    ...(manage ? { action: { label: manage.label, onClick: () => window.location.assign(manage.href) } } : {}),
                })
            } else {
                notifyError(e, "No se pudo enviar el link de check-in.")
            }
        } finally {
            setIsSendingLink(false)
        }
    }

    // Fallback: copy the guest check-in link (frontend URL) to share manually.
    const handleCopyCheckinLink = async () => {
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        const link = `${origin}/checkin/${reservationId}`
        try {
            await navigator.clipboard.writeText(link)
            toast.success("Link de check-in copiado", { description: "Pégalo en WhatsApp o correo para enviarlo al huésped." })
        } catch {
            toast.error("No se pudo copiar el link", { description: link })
        }
    }

    // Opens the PM's email client to message the guest. No in-app messaging
    // endpoint exists yet, so mailto is the pragmatic real action (vs a dead button).
    const handleMessageGuest = () => {
        const email = data?.email?.trim()
        if (!email) {
            toast.error("El huésped no tiene correo registrado.")
            return
        }
        const subject = encodeURIComponent(`Tu reserva ${data?.externalId ?? ""}`.trim())
        const body = encodeURIComponent(`Hola ${data?.guestName ?? ""},\n\n`)
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer")
    }

    // Esqueleto con la forma real del panel, no un spinner centrado: mantiene
    // la posición de cada bloque para que nada salte al llegar los datos.
    if (isLoading) {
        return (
            <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10" aria-busy>
                <span className="sr-only" role="status">Cargando reserva…</span>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-8 w-64" />
                    </div>
                    <Skeleton className="h-10 w-52" />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="flex flex-col gap-6 lg:col-span-8">
                        <Skeleton className="h-80 rounded-xl" />
                        <Skeleton className="h-48 rounded-xl" />
                    </div>
                    <div className="flex flex-col gap-6 lg:col-span-4">
                        <Skeleton className="h-56 rounded-xl" />
                        <Skeleton className="h-40 rounded-xl" />
                    </div>
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-3 text-center">
                <p className="text-base font-semibold text-ink">
                    {error ? "No pudimos cargar la reserva" : "Reserva no encontrada"}
                </p>
                {error && <p className="text-sm text-ink-3">{error}</p>}
                <Button asChild variant="outline">
                    <Link href="/dashboard/reservations">Volver a reservas</Link>
                </Button>
            </div>
        )
    }

    const statusMeta = getReservationStatusMeta(data.status, data.statusLabel, data.statusId)
    const guestName = formatGuestName(data.guestName)
    const isActionable = isReservationActionable(data.status)
    // Un canal que no es Direct llega por channel manager / OTA; el panel antes
    // rotulaba TODA reserva como "Reserva Externa", contradiciendo el
    // "Plataforma Direct" que mostraba justo al lado.
    // Directa solo si el canal dice Directo; sin canal (o «Desconocido»), se dice que no se sabe.
    const channelKind = reservationChannelKind(data.source, data.sourceSlug)
    const channelLabel = channelKind === "external"
        ? `Reserva externa · ${data.source}`
        : channelKind === "direct" ? "Reserva directa" : UNKNOWN_CHANNEL_LABEL
    const disabledReason = isActionable
        ? undefined
        : `La reserva está ${statusMeta.label.toLowerCase()}: no admite acciones sobre el huésped.`
    // Con el alojamiento o la propiedad inactivos no sale ningún link (contrato
    // 2026-10-27 §7.3). Se dice antes del clic; el 422 sigue siendo la autoridad.
    const linkBlockedReason = checkinLinkBlockedReason(data.listingInactiveReason)
    const canUseCheckinLink = isActionable && !linkBlockedReason
    const linkDisabledReason = disabledReason ?? linkBlockedReason ?? undefined

    return (
        <div className="flex flex-col gap-4 sm:gap-6 max-w-7xl mx-auto pb-10">
            {refreshFailed && (
                // Mismo aviso que las listas: la ficha sigue a la vista, pero puede no ser la actual.
                <FeedbackBanner
                    tone="warning"
                    mode="dynamic"
                    action={<Button type="button" size="sm" variant="outline" onClick={reload}>Reintentar</Button>}
                >
                    No pudimos actualizar la reserva. Se muestra la última cargada.
                </FeedbackBanner>
            )}
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div className="min-w-0 space-y-1">
                    <nav aria-label="Ruta de navegación">
                        <ol className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                            <li>
                                <Link
                                    href="/dashboard/reservations"
                                    className="rounded-xs transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    Reservas
                                </Link>
                            </li>
                            <Icon icon={ChevronRight} size="xs" className="text-ink-4" />
                            <li aria-current="page" className="truncate font-semibold text-ink-2">
                                {data.externalId || `${reservationId.slice(0, 8)}…`}
                            </li>
                        </ol>
                    </nav>
                    {/* El h1 nombra la reserva concreta, no la plantilla de la
                        pantalla: "Panel de Operaciones" es idéntico en las mil
                        reservas y no ayuda a saber cuál estás mirando. */}
                    <h1 className="truncate text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                        {guestName}
                    </h1>
                    <p className="text-sm text-ink-3">
                        {data.propertyName} · {format(data.checkIn, "d MMM", { locale: es })} –{" "}
                        {format(data.checkOut, "d MMM yyyy", { locale: es })}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {/* La ficha sigue a la vista mientras se relee (editar, volver a la pestaña). */}
                    <RefreshIndicator active={status === "refreshing"} label="Actualizando reserva…" />
                    <Button onClick={() => window.print()} variant="outline">
                        <Icon icon={Printer} />
                        Imprimir
                    </Button>
                    <ReservationDialog
                        mode="edit"
                        reservationUuid={reservationId}
                        trigger={
                            /* Sin `disabled` a propósito.
                             *
                             * Estuvo bloqueado con `source === "Airbnb"` y el aviso «las
                             * reservas de Airbnb no se pueden editar manualmente», una
                             * regla que NINGÚN contrato respalda: `PUT /reservations/{uuid}`
                             * se documenta sin restricción por canal (FRONTEND_API_ENDPOINTS
                             * §11.2), y Booking —que también se sincroniza— nunca estuvo
                             * bloqueado.
                             *
                             * El bug que lo destapó: `source` es el CANAL COMERCIAL que el PM
                             * elige al crear, no el mecanismo de importación. Una reserva
                             * creada a mano en este mismo dashboard con canal Airbnb (las de
                             * `externalId` "MANUAL-…", que genera este frontend) quedaba
                             * bloqueada como si Airbnb la hubiera importado.
                             *
                             * Quién puede editar qué lo decide el backend: si rechaza una
                             * reserva sincronizada, su error se muestra tal cual. Adivinarlo
                             * acá solo podía equivocarse en los dos sentidos.
                             */
                            <Button title="Editar los detalles de la reserva">
                                <Icon icon={Edit} />
                                Editar reserva
                            </Button>
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Guest & Reservation Info Card */}
                    <Card className="overflow-hidden border-rule p-0 shadow-sm">
                        <CardContent className="p-5 sm:p-6">
                            {/* Top row: Guest & Status */}
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                <div className="flex min-w-0 items-center gap-4">
                                    <Avatar className="size-14 shrink-0">
                                        <AvatarFallback className="bg-primary/10 text-base font-bold text-primary">
                                            {guestInitials(guestName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h2 className="truncate text-lg font-bold leading-tight text-ink sm:text-xl">
                                            {guestName}
                                        </h2>
                                        <p className="mt-1 truncate text-sm text-ink-3">
                                            {channelLabel}
                                            {data.externalId && ` · ${data.externalId}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                    {/* El indicador operativo principal (pedido de producto
                                        2026-08-27): si el check-in de la reserva está completo.
                                        Sale del flag autoritativo del backend
                                        (`isCheckinCompleted`, ya mapeado a
                                        `automationStatus.checkin`), el mismo que pinta la pila
                                        del huésped abajo — una sola fuente, dos lugares. */}
                                    <StatusPill tone={data.automationStatus.checkin === "success" ? "success" : "warning"}>
                                        {data.automationStatus.checkin === "success" ? "Check-in completo" : "Check-in pendiente"}
                                    </StatusPill>
                                    {/* Acá iba un badge «Importada por iCal» derivado de
                                        `source === "Airbnb"`. Se quitó porque afirmaba un
                                        MECANISMO (iCal) a partir de un CANAL: el backend no
                                        expone por dónde entró la reserva —`source_pms` solo
                                        existe a nivel Listing, en `externalPmsIds`—, así que
                                        una reserva creada a mano con canal Airbnb se anunciaba
                                        como importada. El canal ya se lee al lado del nombre
                                        («Reserva externa · Airbnb»), que sí es verdad. */}
                                    <StatusPill tone={statusMeta.tone}>{statusMeta.label}</StatusPill>
                                </div>
                            </div>

                            {/* Details Row.
                                Antes cada dato venía en un chip de icono redondeado —
                                uno gris y tres morados sin criterio, y el morado es el
                                color de ACCIÓN de la marca, no el de un adorno. Ahora el
                                icono acompaña a la etiqueta en tinta apagada y el valor
                                es lo único con peso: la jerarquía la lleva el dato. */}
                            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 border-t border-rule pt-6 lg:grid-cols-4">
                                <DetailCell icon={Home} label="Propiedad" value={data.propertyName} hint={data.unitName} />
                                <DetailCell
                                    icon={Calendar}
                                    label="Estancia"
                                    value={
                                        <span className="flex items-center gap-1.5">
                                            {format(data.checkIn, "d MMM", { locale: es })}
                                            <Icon icon={ChevronRight} size="sm" className="text-ink-4" />
                                            {format(data.checkOut, "d MMM", { locale: es })}
                                        </span>
                                    }
                                    hint={`${format(data.checkIn, "HH:mm")} → ${format(data.checkOut, "HH:mm")}`}
                                />
                                <DetailCell
                                    icon={Moon}
                                    label="Noches"
                                    value={data.nights}
                                    hint={data.nights === 1 ? "noche" : "noches"}
                                />
                                <DetailCell
                                    icon={Users}
                                    label="Huéspedes"
                                    value={data.capacityDeclarationRequired ? "—" : data.totalGuests}
                                    hint={data.capacityDeclarationRequired
                                        ? "por declarar"
                                        : data.totalGuests === 1 ? "huésped" : "huéspedes"}
                                />
                            </dl>

                            {/* Automation Section — live status + manual redispatch */}
                            <div className="mt-6 border-t border-rule pt-6">
                                <AutomationStatusList reservationUuid={data.uuid} totalGuests={data.totalGuests} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Guest Documents */}
                    {/* Montado solo mientras está abierto: cada apertura arranca con
                        el valor vigente sin sincronizar props a estado. */}
                    {priceDialogOpen && (
                        <RegisterPriceDialog
                            reservationUuid={data.uuid}
                            currency={data.currency}
                            mode={data.priceUnconfirmed ? "register" : "correct"}
                            initialValue={data.priceUnconfirmed ? null : data.totalPrice}
                            open
                            onClose={() => setPriceDialogOpen(false)}
                            onSaved={() => reload()}
                        />
                    )}

                    <GuestDocumentsCard reservationUuid={data.uuid} />

                    {/* Property Documents */}
                    <PropertyDocumentsCard reservationUuid={data.uuid} />

                    {/* Activity Log.
                        Un solo evento fijo. Se rotula como "Origen" en vez de
                        "Bitácora de Actividad": una bitácora con una entrada
                        inmutable promete un historial que el backend todavía no
                        expone, y el operador la lee como si no hubiera pasado nada. */}
                    <SectionCard
                        title="Origen de la reserva"
                        description="El historial por evento aún no está disponible."
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-fit rounded-lg bg-sunk p-2 text-ink-3">
                                <Icon icon={FileText} size="lg" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink">Reserva creada</p>
                                <p className="truncate text-xs text-ink-3">
                                    {/* El backend ya expone el origen técnico (2026-08-24,
                                        `isImported`/`importSource` — retroactivos). «Creada
                                        manualmente» solo se afirma con un `false` EXPLÍCITO:
                                        si la clave no vino, se cae al canal, que es lo único
                                        que sí sabemos (ausente ≠ negado). */}
                                    {data.origin.isImported
                                        ? `Importada desde ${data.origin.importSourceLabel ?? "el PMS"}`
                                        : data.origin.originKnown
                                            ? "Creada manualmente en HitGuest"
                                            : channelKind === "external" ? `Canal ${data.source}` : channelLabel}
                                    {" · "}
                                    {data.externalId || data.uuid.slice(0, 8)}
                                </p>
                                {/* `syncedAt` es forward-only: `null` = «no sabemos», así que
                                    simplemente no se muestra — nunca «sin sincronizar». */}
                                {data.origin.isImported && data.origin.syncedAt && (
                                    <p className="text-xs text-ink-3">
                                        Última sincronización:{" "}
                                        {format(new Date(data.origin.syncedAt), "d MMM yyyy, HH:mm", { locale: es })}
                                    </p>
                                )}

                                {/* Airbnb iCal (2026-09-04): el feed no trae valor ni ocupación.
                                    El precio es del PM (accionable: TRA no corre sin él); la
                                    capacidad la declara el huésped (informativo). */}
                                {data.priceUnconfirmed && (
                                    <FeedbackBanner
                                        tone="warning"
                                        density="compact"
                                        className="mt-2"
                                        title="Falta registrar el valor de la reserva."
                                        action={
                                            <Button type="button" size="sm" variant="outline" onClick={() => setPriceDialogOpen(true)}>
                                                Registrar valor
                                            </Button>
                                        }
                                    >
                                        Hasta registrarlo, el reporte a TRA no puede ejecutarse.
                                    </FeedbackBanner>
                                )}
                                {data.capacityDeclarationRequired && (
                                    <p className="mt-2 rounded-lg bg-sunk px-3 py-2 text-xs text-ink-2">
                                        Capacidad por confirmar: el huésped principal la declarará al iniciar
                                        su check-in. No necesitas hacer nada.
                                    </p>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    {/* Ediciones manuales que el webhook del PMS pisó (§2g.4). El PMS
                        gana por decisión de producto — esto es el registro del
                        conflicto, para que la reversión deje de ser silenciosa.
                        `previous`/`incoming` son strings del backend para mostrar. */}
                    {data.overwrittenEdits.length > 0 && (
                        <FeedbackBanner
                            tone="warning"
                            title={`El PMS revirtió ${data.overwrittenEdits.length} ${data.overwrittenEdits.length === 1 ? "cambio manual" : "cambios manuales"}`}
                        >
                            <ul className="mt-1 space-y-1 text-xs">
                                {data.overwrittenEdits.map((edit, index) => (
                                    <li key={`${edit.fieldLabel}-${index}`}>
                                        <span className="font-semibold text-ink">{edit.fieldLabel}:</span>{" "}
                                        {edit.previous} → {edit.incoming}
                                        {edit.overwrittenAt && (
                                            <span className="text-ink-3">
                                                {" "}· {format(new Date(edit.overwrittenAt), "d MMM yyyy, HH:mm", { locale: es })}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </FeedbackBanner>
                    )}
                </div>

                {/* Sidebar Areas */}
                <div className="flex flex-col gap-6 lg:col-span-4">
                    {/* Quick Actions.
                        El título y los iconos estaban en `text-primary`, es
                        decir morado al 50% SOBRE morado: invisibles. Todo lo que
                        va dentro de esta tarjeta se pinta con blancos, también el
                        foco: el outline morado del Button daría 1,23:1 aquí. */}
                    <Card className="border-none bg-primary p-0 text-white shadow-sm">
                        <CardContent className="p-5">
                            <h3 className="text-sm font-bold text-white">Acciones rápidas</h3>
                            {linkDisabledReason && (
                                <p className="mt-1 text-xs text-white/70">{linkDisabledReason}</p>
                            )}
                            <div className="mt-4 space-y-2">
                                <Dialog open={sendDialogOpen} onOpenChange={openSendDialog}>
                                    <DialogTrigger asChild>
                                        <Button size="lg"
                                            variant="inverse"
                                            disabled={!canUseCheckinLink}
                                            title={linkDisabledReason}
                                            className="group w-full justify-between"
                                        >
                                            <span className="flex items-center gap-3">
                                                <Icon icon={Send} className="text-white/70 transition-colors group-hover:text-white" />
                                                <span className="font-semibold">Enviar link de check-in</span>
                                            </span>
                                            <Icon icon={ChevronRight} className="text-white/50" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-110">
                                        <DialogHeader>
                                            <DialogTitle>Enviar link de check-in</DialogTitle>
                                            <DialogDescription>
                                                Se enviará al correo indicado. Por defecto, el del huésped principal.
                                                {/* Cada reenvío por un canal cobrado vuelve a cobrar (§8, §13.8):
                                                    se dice antes de enviar, solo con configuración resuelta. */}
                                                {linkChannels.resolved && resendCharges ? ` ${resendCharges}` : null}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="checkin-link-email">Correo del huésped (opcional)</Label>
                                                <Input
                                                    id="checkin-link-email"
                                                    type="email"
                                                    value={recipientEmail}
                                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                                    placeholder="huesped@correo.com"
                                                />
                                                {trimmedRecipient === "" && (
                                                    <p className="text-xs text-ink-3">
                                                        Si lo dejas vacío, se usa el correo registrado del huésped y los
                                                        demás canales configurados.
                                                    </p>
                                                )}
                                                {!isValidEmail && (
                                                    <p className="text-xs text-danger">Ingresa un correo válido o deja el campo vacío.</p>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="checkin-link-locale">Idioma del correo</Label>
                                                <Select value={localeChoice} onValueChange={(v) => setLocaleChoice(v as "default" | CommunicationLocale)}>
                                                    <SelectTrigger id="checkin-link-locale">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="default">
                                                            Idioma de la propiedad{data.communicationsLocale ? ` · ${LOCALE_LABELS[data.communicationsLocale]}` : ""}
                                                        </SelectItem>
                                                        {COMMUNICATION_LOCALES.map((loc) => (
                                                            <SelectItem key={loc} value={loc}>{LOCALE_LABELS[loc]}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={isSendingLink}>
                                                Cancelar
                                            </Button>
                                            <Button
                                                onClick={handleSendCheckinLink}
                                                disabled={isSendingLink || !isValidEmail}
                                            >
                                                {isSendingLink && <Icon icon={Loader2} className="mr-2 animate-spin" />}
                                                {isSendingLink ? "Enviando..." : "Enviar"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Button size="lg"
                                    onClick={handleCopyCheckinLink}
                                    variant="inverse"
                                    disabled={!canUseCheckinLink}
                                    title={linkDisabledReason}
                                    className="group w-full justify-between"
                                >
                                    <span className="flex items-center gap-3">
                                        <Icon icon={Copy} className="text-white/70 transition-colors group-hover:text-white" />
                                        <span className="font-semibold">Copiar link de check-in</span>
                                    </span>
                                    <Icon icon={ChevronRight} className="text-white/50" />
                                </Button>
                                <Button size="lg"
                                    onClick={handleMessageGuest}
                                    variant="inverse"
                                    disabled={!data.email || !isActionable}
                                    title={!data.email ? "El huésped no tiene correo registrado" : disabledReason}
                                    className="group w-full justify-between"
                                >
                                    <span className="flex items-center gap-3">
                                        <Icon icon={MessageSquare} className="text-white/70 transition-colors group-hover:text-white" />
                                        <span className="font-semibold">Escribir al huésped</span>
                                    </span>
                                    <Icon icon={ChevronRight} className="text-white/50" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Importe.
                        Antes era una SEGUNDA tarjeta morada idéntica a la de
                        acciones — dos bloques del color de marca compitiendo, sin
                        jerarquía entre "haz algo" y "esto es un dato" — y repetía
                        el total tres veces (titular, fila "Total" y grid de
                        arriba). También rotulaba "Pagado" y "Stripe"/"Manual":
                        ReservationDetailData NO trae estado ni método de pago, así
                        que eran literales inventados. Se quedan solo los datos que
                        la API sí devuelve. */}
                    <ReservationPriceCard
                        totalPrice={data.totalPrice}
                        currency={data.currency}
                        nights={data.nights}
                        priceDeclaredByGuest={data.priceDeclaredByGuest}
                        guestPriceDeclaration={data.guestPriceDeclaration}
                        onCorrect={() => setPriceDialogOpen(true)}
                    />

                    {/* Contacto: el panel ya traía email y teléfono y solo los
                        usaba dentro de diálogos, así que el operador no podía
                        verlos sin abrir uno. */}
                    {(data.email || data.phone) && (
                        <SectionCard title="Contacto del huésped">
                            <dl className="space-y-3">
                                {data.email && (
                                    <ContactRow icon={Mail} label="Correo" value={data.email} href={`mailto:${data.email}`} />
                                )}
                                {data.phone && (
                                    <ContactRow icon={Phone} label="Teléfono" value={data.phone} href={`tel:${data.phone}`} />
                                )}
                            </dl>
                        </SectionCard>
                    )}

                    <CheckinLinkDeliveryCard
                        reservationUuid={reservationId}
                        delivery={data.checkinLinkDelivery}
                        channels={linkChannels.channels}
                        channelsResolved={linkChannels.resolved}
                        phone={data.phone}
                        origin={data.origin}
                    />
                </div>
            </div>
        </div>
    )
}

/**
 * One label/value pair in the reservation summary grid.
 *
 * A `<dt>/<dd>` pair, not two `<span>`s: the association between "Huéspedes"
 * and "2" is the whole point of the cell, and a screen reader had no way to
 * hear it before.
 */
function DetailCell({
    icon,
    label,
    value,
    hint,
}: {
    icon: LucideIcon
    label: string
    value: ReactNode
    hint?: string
}) {
    return (
        <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                <Icon icon={icon} size="sm" className="text-ink-4" />
                {label}
            </dt>
            <dd className="mt-1.5 truncate text-base font-bold leading-snug text-ink">{value}</dd>
            {/* Segundo `dd` del mismo término: dentro de un <dl> solo caben dt/dd
                (un <p> rompía la lista de definiciones para el lector). */}
            {hint && <dd className="mt-0.5 truncate text-xs text-ink-3">{hint}</dd>}
        </div>
    )
}

/** A guest contact detail, rendered as an actionable mailto:/tel: link. */
function ContactRow({
    icon,
    label,
    value,
    href,
}: {
    icon: LucideIcon
    label: string
    value: string
    href: string
}) {
    return (
        <div className="flex items-center gap-3">
            <Icon icon={icon} className="text-ink-4" />
            <div className="min-w-0">
                <dt className="text-xs text-ink-3">{label}</dt>
                <dd>
                    <a
                        href={href}
                        className="block truncate rounded-xs text-sm font-medium text-ink transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        {value}
                    </a>
                </dd>
            </div>
        </div>
    )
}
