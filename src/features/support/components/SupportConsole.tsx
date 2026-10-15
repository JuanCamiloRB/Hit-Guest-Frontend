"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Building2, ChevronRight, LogIn, RefreshCw, Search, ShieldAlert, Users } from "lucide-react"
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

function usersCountLabel(count: number): string {
    if (count === 0) return "Sin usuarios"
    return count === 1 ? "1 usuario" : `${count} usuarios`
}

/**
 * Consola de soporte (contrato §4): buscar cliente → elegir cliente → elegir
 * usuario → motivo → entrar. Solo se monta detrás de `SupportAccessGate`.
 *
 * Maestro-detalle: en escritorio, la lista (con scroll propio) a la izquierda y
 * los usuarios fijos a la derecha mientras se recorre la lista; en móvil, al
 * elegir un cliente sus usuarios REEMPLAZAN la lista, con «Volver a clientes».
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

    const summary = clients.kind === "ready"
        ? [
            clients.meta.total != null
                ? `${clients.meta.total} ${clients.meta.total === 1 ? "cliente" : "clientes"}`
                : null,
            clients.meta.lastPage > 1 ? `Página ${clients.meta.currentPage} de ${clients.meta.lastPage}` : null,
        ].filter(Boolean).join(" · ")
        : null

    return (
        <div className="space-y-4">
            <form onSubmit={search} className="flex max-w-3xl flex-wrap gap-3" role="search">
                <label htmlFor="support-client-search" className="sr-only">Buscar cliente</label>
                <div className="relative min-w-[220px] flex-1">
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

            {summary && (
                <p className="text-sm text-slate-600" aria-live="polite">
                    {summary}{query ? <> para «<strong className="font-semibold text-slate-800">{query}</strong>»</> : null}
                </p>
            )}

            {/* `items-start`: cada panel con su altura natural; antes la grilla
                estiraba «Usuarios» hasta el alto de la lista y quedaba un bloque vacío. */}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <div className={cn(selected && "hidden lg:block")}>
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
                                description={query ? "Prueba con el correo, la identificación o el nombre de uno de sus usuarios." : undefined}
                            />
                        )}

                        {clients.kind === "ready" && clients.items.length > 0 && (
                            <>
                                {/* Scroll propio: la paginación y el encabezado no se pierden. */}
                                <ul className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
                                    {clients.items.map((client) => (
                                        <ClientRow
                                            key={client.uuid}
                                            client={client}
                                            selected={selected?.uuid === client.uuid}
                                            onSelect={() => setSelected(client)}
                                        />
                                    ))}
                                </ul>
                                {clients.meta.lastPage > 1 && (
                                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                                        <span>Página {clients.meta.currentPage} de {clients.meta.lastPage}</span>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                                                Anterior
                                            </Button>
                                            <Button variant="outline" size="sm" disabled={page >= clients.meta.lastPage} onClick={() => goTo(page + 1)}>
                                                Siguiente
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </SectionCard>
                </div>

                <div className={cn("lg:sticky lg:top-24", !selected && "hidden lg:block")}>
                    {selected
                        ? <ClientUsers key={selected.uuid} client={selected} onBack={() => setSelected(null)} />
                        : (
                            <SectionCard title="Usuarios" description="Los usuarios del cliente que elijas.">
                                <EmptyState
                                    icon={<Users aria-hidden />}
                                    title="Selecciona un cliente"
                                    description="Aquí aparecerán sus usuarios. Al entrar como uno de ellos verás el panel con sus mismos permisos, y todo lo que hagas quedará a su nombre."
                                />
                            </SectionCard>
                        )}
                </div>
            </div>
        </div>
    )
}

function ClientRow({ client, selected, onSelect }: { client: SupportClient; selected: boolean; onSelect: () => void }) {
    const empty = client.usersCount === 0
    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={cn(
                    "group flex w-full items-center gap-3 border-l-[3px] px-5 py-3.5 text-left transition-colors",
                    selected
                        ? "border-brand-purple bg-brand-purple/10"
                        : "border-transparent hover:bg-slate-50",
                )}
            >
                <span
                    aria-hidden
                    className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        selected ? "bg-brand-purple text-white" : "bg-slate-100 text-slate-600",
                    )}
                >
                    {initialsOf(client.name)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", empty ? "text-slate-500" : "text-slate-900")}>
                        {client.name}
                    </span>
                    <span className="block truncate text-[13px] text-slate-600">
                        {[client.email, client.identificationNumber ? `ID ${client.identificationNumber}` : null]
                            .filter(Boolean).join(" · ") || "—"}
                    </span>
                </span>
                {client.usersCount != null && (
                    <StatusPill tone={empty ? "idle" : "info"}>{usersCountLabel(client.usersCount)}</StatusPill>
                )}
                <ChevronRight
                    size={16}
                    aria-hidden
                    className={cn("shrink-0 transition-colors", selected ? "text-brand-purple" : "text-slate-300 group-hover:text-slate-500")}
                />
            </button>
        </li>
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
function ClientUsers({ client, onBack }: { client: SupportClient; onBack: () => void }) {
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
        <div className="space-y-3">
            {/* Solo en móvil: los usuarios reemplazan la lista. */}
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
                <ArrowLeft size={14} className="mr-1.5" aria-hidden /> Volver a clientes
            </Button>
            <SectionCard flush title={`Usuarios de ${client.name}`} description="Elige el usuario como el que quieres entrar.">
                <p className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3 text-[13px] text-amber-900">
                    <ShieldAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                    Entrarás con los mismos permisos del usuario. Todo lo que hagas quedará a su nombre.
                </p>
                {state.kind === "loading" && <LoadingState rows={4} label="Cargando usuarios" />}
                {state.kind === "error" && <ErrorRow message={state.message} onRetry={reload} />}
                {state.kind === "ready" && state.items.length === 0 && (
                    <EmptyState
                        icon={<Users aria-hidden />}
                        title="Este cliente no tiene usuarios activos"
                        description="No hay nadie como quien entrar en esta cuenta."
                    />
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
                                        <p className="truncate text-[13px] text-slate-600">
                                            {[u.email, role].filter(Boolean).join(" · ")}
                                        </p>
                                        {/* `title` no se ve en un botón deshabilitado en todos los navegadores. */}
                                        {!u.canOpenSession && <p className="text-xs text-amber-700">{BLOCKED_USER_HINT}</p>}
                                    </div>
                                    {/* Icono a pedido de producto (mock aprobado 2026-10-09); el
                                        nombre accesible y el `title` dicen «Entrar como …». */}
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
        </div>
    )
}
