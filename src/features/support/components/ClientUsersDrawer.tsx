"use client"

import { useEffect, useState } from "react"
import { LogIn, RefreshCw, ShieldAlert, Users, X } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Label } from "@/components/ui/label"
import { LoadingState } from "@/components/ui/loading-state"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { StatusPill } from "@/components/ui/status-pill"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/notify-error"
import { supportService } from "../services/support-service"
import { enterSupportSession } from "../lib/support-session"
import { defaultSupportUser, describeStartError, supportReasonError } from "../lib/start-session"
import type { SupportClient, SupportClientUser } from "../lib/support-readers"
import { roleLabel } from "../lib/support-display"
import { Radio } from "@/components/ui/radio"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { FieldHint } from "@/components/ui/form"

type UsersState =
    | { kind: "loading" }
    | { kind: "ready"; items: SupportClientUser[] }
    | { kind: "error"; message: string }

const BLOCKED_USER_HINT = "No disponible: no ha verificado su correo o es personal de HIT."

/**
 * Panel lateral de un cliente: sus usuarios, el motivo y «Entrar como», TODO en
 * el mismo panel (contrato §4). No abre un segundo diálogo: un modal sobre otro
 * confunde y rompe el foco del teclado. En móvil ocupa la pantalla completa.
 */
export function ClientUsersDrawer({
    client,
    onClose,
    returnFocusTo,
}: {
    client: SupportClient | null
    onClose: () => void
    /**
     * El botón que abrió el panel. Radix solo devuelve el foco a un `Trigger`
     * propio; acá el panel se abre desde la tabla, así que se devuelve a mano.
     */
    returnFocusTo?: () => HTMLElement | null
}) {
    const [busy, setBusy] = useState(false)
    // Motivo escrito y sin enviar: Esc o un clic fuera no lo descartan en
    // silencio; se confirma DENTRO del panel (nunca un segundo diálogo).
    const [dirty, setDirty] = useState(false)
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    const close = () => {
        setDirty(false)
        setConfirmDiscard(false)
        onClose()
    }

    /** Cierre protegido: Esc, clic fuera y la X pasan por acá; con motivo escrito, se confirma. */
    const requestClose = () => {
        if (busy) return
        if (dirty) setConfirmDiscard(true)
        else close()
    }

    return (
        <Sheet
            open={client !== null}
            onOpenChange={(open) => { if (!open) requestClose() }}
        >
            {/* Escritorio clamp(520px, 42vw, 680px); tablet 80vw; móvil, pantalla completa. */}
            <SheetContent
                side="right"
                showCloseButton={false}
                className="w-full gap-0 p-0 sm:w-[80vw] sm:max-w-none lg:w-[clamp(520px,42vw,680px)]"
                onCloseAutoFocus={(event) => {
                    const target = returnFocusTo?.()
                    if (target) {
                        event.preventDefault()
                        target.focus()
                    }
                }}
            >
                {client && (
                    <DrawerBody
                        key={client.uuid}
                        client={client}
                        busy={busy}
                        onBusyChange={setBusy}
                        onDirtyChange={setDirty}
                        confirmDiscard={confirmDiscard}
                        onKeepEditing={() => setConfirmDiscard(false)}
                        onRequestClose={requestClose}
                        onClose={close}
                    />
                )}
            </SheetContent>
        </Sheet>
    )
}

function DrawerBody({
    client,
    busy,
    onBusyChange,
    onDirtyChange,
    confirmDiscard,
    onKeepEditing,
    onRequestClose,
    onClose,
}: {
    client: SupportClient
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onDirtyChange: (dirty: boolean) => void
    /** El agente intentó cerrar (Esc o clic fuera) con un motivo escrito. */
    confirmDiscard: boolean
    onKeepEditing: () => void
    /** Cierre protegido (la X): confirma si hay un motivo escrito. */
    onRequestClose: () => void
    /** Cierre directo: «Cancelar» y «Descartar y cerrar». */
    onClose: () => void
}) {
    const [state, setState] = useState<UsersState>({ kind: "loading" })
    const [reloadKey, setReloadKey] = useState(0)
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
    const [reason, setReason] = useState("")
    const [touched, setTouched] = useState(false)
    const [error, setError] = useState<{ field: "reason" | null; message: string } | null>(null)

    // Tras un 422 `userUuid` (el usuario ya no existe) no se elige a nadie solo:
    // el motivo era para OTRA persona y una acción sensible exige elegir de nuevo.
    const [autoSelect, setAutoSelect] = useState(true)

    useEffect(() => {
        let active = true
        supportService.listClientUsers(client.uuid)
            .then((items) => {
                if (!active) return
                setState({ kind: "ready", items })
                if (autoSelect) setSelectedUuid((current) => current ?? defaultSupportUser(items))
            })
            .catch((err) => {
                if (active) setState({ kind: "error", message: getErrorMessage(err, "No se pudieron cargar los usuarios.") })
            })
        return () => { active = false }
    }, [client.uuid, reloadKey, autoSelect])

    const reload = () => {
        setState({ kind: "loading" })
        setSelectedUuid(null)
        setReloadKey((k) => k + 1)
    }

    /** El usuario elegido ya no existe: se descartan elección y motivo, y se elige a mano. */
    const reloadAfterUserGone = () => {
        setReason("")
        setTouched(false)
        setAutoSelect(false)
        reload()
    }

    useEffect(() => { onDirtyChange(reason.trim() !== "") }, [reason, onDirtyChange])

    const users = state.kind === "ready" ? state.items : []
    const selectedUser = users.find((u) => u.uuid === selectedUuid && u.canOpenSession) ?? null
    const localProblem = supportReasonError(reason)
    const reasonMessage = error?.field === "reason" ? error.message : touched ? localProblem : null

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setTouched(true)
        if (!selectedUser || localProblem) return
        onBusyChange(true)
        setError(null)
        try {
            const started = await supportService.startSession({ userUuid: selectedUser.uuid, reason: reason.trim() })
            // Navega al panel del cliente: este panel no vuelve a pintarse.
            enterSupportSession(started)
        } catch (raw) {
            const described = describeStartError(raw)
            setError({
                field: described.field,
                message: described.userGone ? `${described.message} Vuelve a elegir el usuario.` : described.message,
            })
            onBusyChange(false)
            if (described.userGone) reloadAfterUserGone()
        }
    }

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-start gap-3 border-b border-rule px-6 py-5">
                <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-lg font-bold text-ink" title={client.name}>{client.name}</SheetTitle>
                    <SheetDescription className="mt-0.5 text-sm text-ink-2">
                        {[client.email, client.identificationNumber ? `ID ${client.identificationNumber}` : null]
                            .filter(Boolean).join(" · ") || "Cliente"}
                    </SheetDescription>
                </div>
                <Button variant="ghost" size="icon-lg" onClick={onRequestClose} disabled={busy} aria-label="Cerrar">
                    <Icon icon={X} />
                </Button>
            </header>

            <FeedbackBanner tone="warning" layout="bar" icon={ShieldAlert} className="border-b border-warning/20">
                Entrarás con los mismos permisos del usuario. Todo lo que hagas quedará a su nombre.
            </FeedbackBanner>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {state.kind === "loading" && <LoadingState rows={3} label="Cargando usuarios" />}

                    {state.kind === "error" && (
                        <FeedbackBanner
                            tone="danger"
                            mode="dynamic"
                            action={
                                <Button type="button" variant="outline" size="sm" onClick={reload}>
                                    <Icon icon={RefreshCw} className="mr-1.5" /> Reintentar
                                </Button>
                            }
                        >
                            {state.message}
                        </FeedbackBanner>
                    )}

                    {state.kind === "ready" && users.length === 0 && (
                        <EmptyState
                            icon={Users}
                            title="Este cliente no tiene usuarios activos"
                            description="No hay nadie como quien entrar en esta cuenta."
                        />
                    )}

                    {state.kind === "ready" && users.length > 0 && (
                        <fieldset className="space-y-2">
                            <legend className="mb-2 text-sm font-semibold text-ink-2">
                                {users.length === 1 ? "Usuario" : `Elige el usuario (${users.length})`}
                            </legend>
                            {users.map((u) => {
                                const role = roleLabel(u.role)
                                const checked = selectedUuid === u.uuid
                                return (
                                    <Label variant="plain"
                                        key={u.uuid}
                                        className={cn(
                                            "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                                            !u.canOpenSession
                                                ? "cursor-not-allowed border-rule bg-sunk/50 opacity-70"
                                                : checked
                                                    ? "cursor-pointer border-primary bg-primary/5"
                                                    : "cursor-pointer border-rule hover:border-input-hover",
                                        )}
                                    >
                                        <Radio

                                            name="support-user"
                                            value={u.uuid}
                                            checked={checked}
                                            disabled={!u.canOpenSession || busy}
                                            onChange={() => { setSelectedUuid(u.uuid); setError(null) }}
                                            className="mt-1 accent-primary"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                                                <span className="truncate" title={u.name}>{u.name}</span>
                                                {u.isAccountOwner && <StatusPill tone="info">Dueño</StatusPill>}
                                            </span>
                                            <span className="block truncate text-sm text-ink-2">
                                                {[u.email, role].filter(Boolean).join(" · ")}
                                            </span>
                                            {!u.canOpenSession && (
                                                <span className="block text-xs text-warning">{BLOCKED_USER_HINT}</span>
                                            )}
                                        </span>
                                    </Label>
                                )
                            })}
                        </fieldset>
                    )}
                </div>

                {state.kind === "ready" && users.length > 0 && (
                    <div className="space-y-3 border-t border-rule bg-card px-6 py-5">
                        {selectedUser ? (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="support-reason">Motivo del acceso</Label>
                                    <Textarea
                                        id="support-reason"
                                        value={reason}
                                        onChange={(e) => {
                                            setReason(e.target.value)
                                            if (error?.field === "reason") setError(null)
                                        }}
                                        onBlur={() => setTouched(true)}
                                        placeholder="Ticket 77: revisar contrato"
                                        rows={3}
                                        disabled={busy}
                                        aria-invalid={reasonMessage ? true : undefined}
                                        aria-describedby="support-reason-help"
                                    />
                                    <FieldHint id="support-reason-help" compact invalid={Boolean(reasonMessage)}>
                                        {reasonMessage ?? "Queda registrado en la sesión de soporte."}
                                    </FieldHint>
                                </div>
                                <p className="text-sm text-ink-2">
                                    Entrarás como <strong>{selectedUser.name}</strong> en <strong>{client.name}</strong>.
                                    Las acciones quedarán registradas a su nombre.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-ink-2">Elige el usuario como el que quieres entrar.</p>
                        )}

                        {error?.field === null && (
                            <p role="alert" className="rounded-lg bg-danger-sunk px-3 py-2 text-sm text-danger">
                                {error.message}
                            </p>
                        )}

                        {confirmDiscard ? (
                            // Interrumpe (`alert`): perder el motivo escrito es destructivo.
                            <FeedbackBanner
                                tone="danger"
                                mode="blocking"
                                action={
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={onKeepEditing}>Seguir aquí</Button>
                                        <Button type="button" variant="destructive" size="sm" onClick={onClose}>Descartar y cerrar</Button>
                                    </div>
                                }
                            >
                                Ya escribiste un motivo. ¿Cerrar sin entrar y descartarlo?
                            </FeedbackBanner>
                        ) : (
                            <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button size="lg" type="button" variant="outline" onClick={onClose} disabled={busy}>
                                    Cancelar
                                </Button>
                                {/* Un nombre largo se corta con «…» dentro del botón (que no
                                    parte líneas); el nombre completo queda en aria-label y title. */}
                                <Button size="lg" type="submit" className="min-w-0 max-w-full" disabled={!selectedUser} aria-label={selectedUser ? `Entrar como ${selectedUser.name}` : undefined} title={selectedUser ? `Entrar como ${selectedUser.name}` : undefined} loading={busy}>
                                    <Icon icon={LogIn} className="mr-1.5" />
                                    <span className="truncate">{selectedUser ? `Entrar como ${selectedUser.name}` : "Elige un usuario"}</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    )
}
