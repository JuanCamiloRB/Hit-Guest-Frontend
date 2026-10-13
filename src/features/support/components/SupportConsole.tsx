"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Building2, LogIn, RefreshCw, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/notify-error"
import { supportService } from "../services/support-service"
import type { PageMeta, SupportClient, SupportClientUser } from "../lib/support-readers"
import { initialsOf, roleLabel } from "../lib/support-display"
import { StartSupportSessionDialog, type SupportTarget } from "./StartSupportSessionDialog"

type ClientsState =
    | { kind: "loading" }
    | { kind: "ready"; items: SupportClient[]; meta: PageMeta }
    | { kind: "error"; message: string }

type UsersState =
    | { kind: "loading" }
    | { kind: "ready"; items: SupportClientUser[] }
    | { kind: "error"; message: string }

const BLOCKED_USER_HINT = "No se puede entrar como este usuario: no ha verificado su correo o es personal de HIT."

/**
 * Consola de soporte (contrato §4): buscar cliente → elegir cliente → elegir
 * usuario → motivo → entrar. Solo se monta detrás de `SupportAccessGate`.
 */
export function SupportConsole() {
    const searchParams = useSearchParams()
    const [draft, setDraft] = useState("")
    const [query, setQuery] = useState("")
    const [page, setPage] = useState(1)
    const [reloadKey, setReloadKey] = useState(0)
    const [clients, setClients] = useState<ClientsState>({ kind: "loading" })
    const [selected, setSelected] = useState<SupportClient | null>(null)

    // El 401 de una sesión de soporte cerrada trae de vuelta acá (api-client).
    useEffect(() => {
        if (searchParams.get("session") === "ended") {
            toast.info("La sesión de soporte se cerró", {
                description: "Venció por inactividad, se abrió otra o se revocó. Estás de vuelta en la consola.",
            })
        }
    }, [searchParams])

    useEffect(() => {
        let active = true
        supportService.listClients({ search: query, page })
            .then((result) => { if (active) setClients({ kind: "ready", items: result.items, meta: result.meta }) })
            .catch((error) => {
                if (active) setClients({ kind: "error", message: getErrorMessage(error, "No se pudo buscar clientes.") })
            })
        return () => { active = false }
    }, [query, page, reloadKey])

    const search = (event: React.FormEvent) => {
        event.preventDefault()
        setClients({ kind: "loading" })
        setSelected(null)
        setPage(1)
        setQuery(draft)
    }

    const goTo = (next: number) => {
        setClients({ kind: "loading" })
        setPage(next)
    }

    return (
        <div className="space-y-5">
            <form onSubmit={search} className="flex flex-wrap gap-3" role="search">
                <label htmlFor="support-client-search" className="sr-only">Buscar cliente</label>
                <div className="relative min-w-[240px] flex-1">
                    <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                        id="support-client-search"
                        type="search"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Nombre, correo, identificación o usuario del cliente…"
                        className="h-11 pl-9"
                    />
                </div>
                <Button type="submit" className="h-11">Buscar</Button>
            </form>

            <div className="grid gap-5 lg:grid-cols-2">
                <SectionCard flush title="Clientes" description="Elige un cliente para ver sus usuarios.">
                    {clients.kind === "loading" && <LoadingState rows={6} label="Buscando clientes" />}

                    {clients.kind === "error" && (
                        <ErrorRow
                            message={clients.message}
                            onRetry={() => { setClients({ kind: "loading" }); setReloadKey((k) => k + 1) }}
                        />
                    )}

                    {clients.kind === "ready" && clients.items.length === 0 && (
                        <EmptyState
                            icon={<Building2 aria-hidden />}
                            title={query ? "Ningún cliente coincide con la búsqueda" : "Todavía no hay clientes"}
                        />
                    )}

                    {clients.kind === "ready" && clients.items.length > 0 && (
                        <>
                            <ul className="divide-y divide-slate-100">
                                {clients.items.map((client) => {
                                    const isSelected = selected?.uuid === client.uuid
                                    return (
                                        <li key={client.uuid}>
                                            <button
                                                type="button"
                                                onClick={() => setSelected(client)}
                                                aria-pressed={isSelected}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50",
                                                    isSelected && "bg-brand-purple/5",
                                                )}
                                            >
                                                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-xs font-bold text-brand-purple">
                                                    {initialsOf(client.name)}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-slate-900">{client.name}</span>
                                                    <span className="block truncate text-xs text-slate-500">
                                                        {[client.email, client.identificationNumber].filter(Boolean).join(" · ") || "—"}
                                                    </span>
                                                </span>
                                                {client.usersCount != null && (
                                                    <span className="shrink-0 text-xs text-slate-500">
                                                        {client.usersCount} {client.usersCount === 1 ? "usuario" : "usuarios"}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                                <span>
                                    Página {clients.meta.currentPage} de {clients.meta.lastPage}
                                    {clients.meta.total != null ? ` · ${clients.meta.total} clientes` : ""}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                                        Anterior
                                    </Button>
                                    <Button variant="outline" size="sm" disabled={page >= clients.meta.lastPage} onClick={() => goTo(page + 1)}>
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </SectionCard>

                {selected
                    ? <ClientUsers key={selected.uuid} client={selected} />
                    : (
                        <SectionCard title="Usuarios">
                            <p className="text-sm text-slate-500">Elige un cliente de la lista.</p>
                        </SectionCard>
                    )}
            </div>
        </div>
    )
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm">
            <span className="text-red-700">{message}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw size={14} className="mr-1.5" /> Reintentar
            </Button>
        </div>
    )
}

/** Usuarios activos del cliente (dueño primero) con la entrada a cada uno. */
function ClientUsers({ client }: { client: SupportClient }) {
    const [state, setState] = useState<UsersState>({ kind: "loading" })
    const [reloadKey, setReloadKey] = useState(0)
    const [target, setTarget] = useState<SupportTarget | null>(null)

    useEffect(() => {
        let active = true
        supportService.listClientUsers(client.uuid)
            .then((items) => { if (active) setState({ kind: "ready", items }) })
            .catch((error) => {
                if (active) setState({ kind: "error", message: getErrorMessage(error, "No se pudieron cargar los usuarios.") })
            })
        return () => { active = false }
    }, [client.uuid, reloadKey])

    const reload = () => {
        setState({ kind: "loading" })
        setReloadKey((k) => k + 1)
    }

    return (
        <SectionCard
            flush
            title={`Usuarios de ${client.name}`}
            description="Entrar como un usuario te muestra el panel con sus mismos permisos. Todo lo que hagas queda a su nombre."
        >
            {state.kind === "loading" && <LoadingState rows={4} label="Cargando usuarios" />}
            {state.kind === "error" && <ErrorRow message={state.message} onRetry={reload} />}
            {state.kind === "ready" && state.items.length === 0 && (
                <EmptyState icon={<Users aria-hidden />} title="Este cliente no tiene usuarios activos" />
            )}
            {state.kind === "ready" && state.items.length > 0 && (
                <ul className="divide-y divide-slate-100">
                    {state.items.map((u) => {
                        const role = roleLabel(u.role)
                        return (
                            <li key={u.uuid} className="flex items-center gap-3 px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                        <span className="truncate">{u.name}</span>
                                        {u.isAccountOwner && <StatusPill tone="info">Dueño</StatusPill>}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {[u.email, role].filter(Boolean).join(" · ")}
                                    </p>
                                    {/* `title` no se ve en un botón deshabilitado en todos los navegadores. */}
                                    {!u.canOpenSession && <p className="text-xs text-amber-700">{BLOCKED_USER_HINT}</p>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTarget({ uuid: u.uuid, name: u.name, email: u.email, isAccountOwner: u.isAccountOwner })}
                                    disabled={!u.canOpenSession}
                                    aria-label={`Entrar como ${u.name}`}
                                    title={u.canOpenSession ? `Entrar como ${u.name}` : BLOCKED_USER_HINT}
                                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand-purple/30 bg-white text-brand-purple transition-colors hover:bg-brand-purple/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <LogIn size={18} aria-hidden />
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}

            <StartSupportSessionDialog
                open={target !== null}
                onOpenChange={(open) => { if (!open) setTarget(null) }}
                target={target}
                clientName={client.name}
                onUserGone={reload}
            />
        </SectionCard>
    )
}
