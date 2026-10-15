"use client"

import { useEffect, useState } from "react"
import { Loader2, LogIn, RefreshCw, ShieldAlert, Users, X } from "lucide-react"
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

    return (
        <Sheet
            open={client !== null}
            onOpenChange={(open) => {
                if (open || busy) return
                if (dirty) setConfirmDiscard(true)
                else close()
            }}
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
    onClose,
}: {
    client: SupportClient
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onDirtyChange: (dirty: boolean) => void
    /** El agente intentó cerrar (Esc o clic fuera) con un motivo escrito. */
    confirmDiscard: boolean
    onKeepEditing: () => void
    onClose: () => void
}) {
    const [state, setState] = useState<UsersState>({ kind: "loading" })
    const [reloadKey, setReloadKey] = useState(0)
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
    const [reason, setReason] = useState("")
    const [touched, setTouched] = useState(false)
    const [error, setError] = useState<{ field: "reason" | null; message: string } | null>(null)

    useEffect(() => {
        let active = true
        supportService.listClientUsers(client.uuid)
            .then((items) => {
                if (!active) return
                setState({ kind: "ready", items })
                setSelectedUuid((current) => current ?? defaultSupportUser(items))
            })
            .catch((err) => {
                if (active) setState({ kind: "error", message: getErrorMessage(err, "No se pudieron cargar los usuarios.") })
            })
        return () => { active = false }
    }, [client.uuid, reloadKey])

    const reload = () => {
        setState({ kind: "loading" })
        setSelectedUuid(null)
        setReloadKey((k) => k + 1)
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
            setError({ field: described.field, message: described.message })
            onBusyChange(false)
            if (described.userGone) reload()
        }
    }

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
                <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-lg font-bold text-slate-900" title={client.name}>{client.name}</SheetTitle>
                    <SheetDescription className="mt-0.5 text-[13px] text-slate-600">
                        {[client.email, client.identificationNumber ? `ID ${client.identificationNumber}` : null]
                            .filter(Boolean).join(" · ") || "Cliente"}
                    </SheetDescription>
                </div>
                <Button variant="ghost" size="icon-lg" onClick={onClose} disabled={busy} aria-label="Cerrar">
                    <X size={18} aria-hidden />
                </Button>
            </header>

            <p className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-6 py-3 text-[13px] text-amber-900">
                <ShieldAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                Entrarás con los mismos permisos del usuario. Todo lo que hagas quedará a su nombre.
            </p>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {state.kind === "loading" && <LoadingState rows={3} label="Cargando usuarios" />}

                    {state.kind === "error" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm">
                            <span className="text-red-700">{state.message}</span>
                            <Button type="button" variant="outline" size="sm" onClick={reload}>
                                <RefreshCw size={14} className="mr-1.5" /> Reintentar
                            </Button>
                        </div>
                    )}

                    {state.kind === "ready" && users.length === 0 && (
                        <EmptyState
                            icon={<Users aria-hidden />}
                            title="Este cliente no tiene usuarios activos"
                            description="No hay nadie como quien entrar en esta cuenta."
                        />
                    )}

                    {state.kind === "ready" && users.length > 0 && (
                        <fieldset className="space-y-2">
                            <legend className="mb-2 text-sm font-semibold text-slate-700">
                                {users.length === 1 ? "Usuario" : `Elige el usuario (${users.length})`}
                            </legend>
                            {users.map((u) => {
                                const role = roleLabel(u.role)
                                const checked = selectedUuid === u.uuid
                                return (
                                    <label
                                        key={u.uuid}
                                        className={cn(
                                            "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                                            !u.canOpenSession
                                                ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70"
                                                : checked
                                                    ? "cursor-pointer border-brand-purple bg-brand-purple/5"
                                                    : "cursor-pointer border-slate-200 hover:border-slate-300",
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="support-user"
                                            value={u.uuid}
                                            checked={checked}
                                            disabled={!u.canOpenSession || busy}
                                            onChange={() => { setSelectedUuid(u.uuid); setError(null) }}
                                            className="mt-1 accent-[var(--color-brand-purple)]"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                                <span className="truncate" title={u.name}>{u.name}</span>
                                                {u.isAccountOwner && <StatusPill tone="info">Dueño</StatusPill>}
                                            </span>
                                            <span className="block truncate text-[13px] text-slate-600">
                                                {[u.email, role].filter(Boolean).join(" · ")}
                                            </span>
                                            {!u.canOpenSession && (
                                                <span className="block text-xs text-amber-700">{BLOCKED_USER_HINT}</span>
                                            )}
                                        </span>
                                    </label>
                                )
                            })}
                        </fieldset>
                    )}
                </div>

                {state.kind === "ready" && users.length > 0 && (
                    <div className="space-y-3 border-t border-slate-100 bg-white px-6 py-5">
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
                                    <p id="support-reason-help" className={reasonMessage ? "text-xs text-red-600" : "text-xs text-slate-500"}>
                                        {reasonMessage ?? "Queda registrado en la sesión de soporte."}
                                    </p>
                                </div>
                                <p className="text-[13px] text-slate-700">
                                    Entrarás como <strong>{selectedUser.name}</strong> en <strong>{client.name}</strong>.
                                    Las acciones quedarán registradas a su nombre.
                                </p>
                            </>
                        ) : (
                            <p className="text-[13px] text-slate-600">Elige el usuario como el que quieres entrar.</p>
                        )}

                        {error?.field === null && (
                            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error.message}
                            </p>
                        )}

                        {confirmDiscard ? (
                            <div role="alert" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                                <p>Ya escribiste un motivo. ¿Cerrar sin entrar y descartarlo?</p>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={onKeepEditing}>Seguir aquí</Button>
                                    <Button type="button" variant="destructive" size="sm" onClick={onClose}>Descartar y cerrar</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" className="h-11" onClick={onClose} disabled={busy}>
                                    Cancelar
                                </Button>
                                <Button type="submit" className="h-11" disabled={busy || !selectedUser}>
                                    {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="mr-1.5 h-4 w-4" aria-hidden />}
                                    {selectedUser ? `Entrar como ${selectedUser.name}` : "Elige un usuario"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    )
}
