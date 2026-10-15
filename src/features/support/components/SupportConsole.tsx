"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Building2, RefreshCw, Search } from "lucide-react"
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
import type { PageMeta, SupportClient } from "../lib/support-readers"
import { initialsOf } from "../lib/support-display"
import { ClientUsersDrawer } from "./ClientUsersDrawer"

type ClientsState =
    | { kind: "loading" }
    | { kind: "ready"; items: SupportClient[]; meta: PageMeta }
    | { kind: "error"; message: string }

function usersCountLabel(count: number): string {
    if (count === 0) return "Sin usuarios"
    return count === 1 ? "1 usuario" : `${count} usuarios`
}

/**
 * Consola de soporte (contrato §4): buscar cliente → «Ver usuarios» → en el
 * panel lateral, elegir usuario, motivo y «Entrar como». Solo se monta detrás
 * de `SupportAccessGate`.
 *
 * Tabla a todo el ancho + panel lateral (auditoría visual 2026-10-16): casi
 * todos los clientes tienen un usuario, y un panel fijo a la derecha ocupaba
 * media pantalla para mostrar una sola fila.
 */
export function SupportConsole() {
    const searchParams = useSearchParams()
    const [draft, setDraft] = useState("")
    const [query, setQuery] = useState("")
    const [page, setPage] = useState(1)
    const [reloadKey, setReloadKey] = useState(0)
    const [clients, setClients] = useState<ClientsState>({ kind: "loading" })
    const [opened, setOpened] = useState<SupportClient | null>(null)
    // El botón «Ver usuarios» que abrió el panel: recibe el foco al cerrarlo.
    const openerRef = useRef<HTMLElement | null>(null)
    const open = (client: SupportClient, opener: HTMLElement) => {
        openerRef.current = opener
        setOpened(client)
    }

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

            <SectionCard flush title="Clientes">
                {clients.kind === "loading" && <LoadingState rows={6} label="Buscando clientes" />}

                {clients.kind === "error" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm">
                        <span className="text-red-700">{clients.message}</span>
                        <Button variant="outline" size="sm" onClick={() => { setClients({ kind: "loading" }); setReloadKey((k) => k + 1) }}>
                            <RefreshCw size={14} className="mr-1.5" /> Reintentar
                        </Button>
                    </div>
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
                        {/* Desde md, tabla; en pantallas angostas, tarjetas (sin scroll horizontal). */}
                        <div className="hidden md:block">
                            <table className="w-full table-fixed text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                                        <th scope="col" className="w-[34%] px-5 py-3 font-semibold">Cliente</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Correo</th>
                                        <th scope="col" className="hidden w-[14%] px-5 py-3 font-semibold lg:table-cell">Identificación</th>
                                        <th scope="col" className="w-[13%] px-5 py-3 font-semibold">Usuarios</th>
                                        <th scope="col" className="w-[15%] px-5 py-3"><span className="sr-only">Acción</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.items.map((client) => (
                                        <ClientRow
                                            key={client.uuid}
                                            client={client}
                                            opened={opened?.uuid === client.uuid}
                                            onOpen={(opener) => open(client, opener)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ul className="divide-y divide-slate-100 md:hidden">
                            {clients.items.map((client) => (
                                <ClientCard key={client.uuid} client={client} onOpen={(opener) => open(client, opener)} />
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

            <ClientUsersDrawer client={opened} onClose={() => setOpened(null)} returnFocusTo={() => openerRef.current} />
        </div>
    )
}

/** Botón de la acción; un cliente sin usuarios no tiene a quién abrir y no la ofrece. */
function OpenUsersButton({ client, onOpen, className }: { client: SupportClient; onOpen: (opener: HTMLElement) => void; className?: string }) {
    if (client.usersCount === 0) return null
    return (
        <Button variant="outline" size="sm" onClick={(event) => onOpen(event.currentTarget)} aria-label={`Ver usuarios de ${client.name}`} className={className}>
            Ver usuarios
        </Button>
    )
}

function UsersCountPill({ count }: { count: number | null }) {
    if (count == null) return <>—</>
    return <StatusPill tone={count === 0 ? "idle" : "info"}>{usersCountLabel(count)}</StatusPill>
}

/**
 * Fila de cliente. Una sola acción explícita («Ver usuarios»): la fila entera
 * clicable duplicaba la interacción y complicaba el teclado y los lectores de
 * pantalla. Un cliente sin usuarios sigue legible, solo sin la acción.
 */
function ClientRow({ client, opened, onOpen }: { client: SupportClient; opened: boolean; onOpen: (opener: HTMLElement) => void }) {
    const empty = client.usersCount === 0
    return (
        <tr className={cn("border-b border-slate-100 last:border-b-0", opened && "bg-brand-purple/5")}>
            <td className="px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                    >
                        {initialsOf(client.name)}
                    </span>
                    {/* Truncado solo a la vista: el texto completo sigue en el DOM. */}
                    <p className={cn("truncate font-semibold", empty ? "text-slate-600" : "text-slate-900")} title={client.name}>
                        {client.name}
                    </p>
                </div>
            </td>
            <td className="truncate px-5 py-3.5 text-slate-700" title={client.email ?? undefined}>{client.email ?? "—"}</td>
            <td className="hidden px-5 py-3.5 tabular-nums text-slate-700 lg:table-cell">{client.identificationNumber ?? "—"}</td>
            <td className="px-5 py-3.5"><UsersCountPill count={client.usersCount} /></td>
            <td className="px-5 py-3.5 text-right"><OpenUsersButton client={client} onOpen={onOpen} /></td>
        </tr>
    )
}

/** La misma información en pantallas angostas, como tarjeta. */
function ClientCard({ client, onOpen }: { client: SupportClient; onOpen: (opener: HTMLElement) => void }) {
    const empty = client.usersCount === 0
    return (
        <li className="space-y-2 px-5 py-4">
            <div className="min-w-0">
                <p className={cn("truncate font-semibold", empty ? "text-slate-600" : "text-slate-900")} title={client.name}>
                    {client.name}
                </p>
                {client.email && <p className="truncate text-[13px] text-slate-600">{client.email}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
                    {client.identificationNumber && <span className="tabular-nums">ID {client.identificationNumber}</span>}
                    <UsersCountPill count={client.usersCount} />
                </p>
            </div>
            <OpenUsersButton client={client} onOpen={onOpen} className="h-10 w-full" />
        </li>
    )
}
