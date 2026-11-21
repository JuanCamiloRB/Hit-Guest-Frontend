"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Building2, RefreshCw, Search } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { getErrorMessage } from "@/lib/notify-error"
import { supportService } from "../services/support-service"
import type { PageMeta, SupportClient } from "../lib/support-readers"
import { ClientUsersDrawer } from "./ClientUsersDrawer"
import { Label } from "@/components/ui/label"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { AbsentValue, ActionsHeader, IdentityCell } from "@/components/shared/table-cells"

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
    // Cambiar de página deja la anterior a la vista hasta que llega la nueva.
    const [paging, setPaging] = useState(false)
    const [opened, setOpened] = useState<SupportClient | null>(null)
    // El botón «Ver usuarios» que abrió el panel: recibe el foco al cerrarlo.
    const [opener, setOpener] = useState<HTMLElement | null>(null)
    // Estable: las columnas se arman una vez (una celda nueva por render se
    // remontaría y el foco no podría volver al botón que abrió el panel).
    const open = useCallback((client: SupportClient, from: HTMLElement) => {
        setOpener(from)
        setOpened(client)
    }, [])
    const columns = useMemo(() => clientColumns(open), [open])

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
            .finally(() => { if (active) setPaging(false) })
        return () => { active = false }
    }, [query, page, reloadKey])

    const search = (event: React.FormEvent) => {
        event.preventDefault()
        setClients({ kind: "loading" })
        setPage(1)
        setQuery(draft)
    }

    const goTo = (next: number) => {
        setPaging(true)
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
                <Label variant="plain" htmlFor="support-client-search" className="sr-only">Buscar cliente</Label>
                <div className="relative min-w-55 flex-1">
                    <Icon icon={Search} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                    <Input
                        id="support-client-search"
                        type="search"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Nombre, correo, identificación o usuario del cliente…"
                        className="h-11 pl-9"
                    />
                </div>
                <Button size="lg" type="submit">Buscar</Button>
            </form>

            {summary && (
                <p className="text-sm text-ink-2" aria-live="polite">
                    {summary}{query ? <> para «<strong className="font-semibold text-ink">{query}</strong>»</> : null}
                </p>
            )}

            <SectionCard flush title="Clientes">
                {clients.kind === "loading" && <LoadingState rows={6} label="Buscando clientes" />}

                {clients.kind === "error" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm">
                        <span className="text-danger">{clients.message}</span>
                        <Button variant="outline" size="sm" onClick={() => { setClients({ kind: "loading" }); setReloadKey((k) => k + 1) }}>
                            <Icon icon={RefreshCw} className="mr-1.5" /> Reintentar
                        </Button>
                    </div>
                )}

                {clients.kind === "ready" && (
                    <div className="p-4">
                        <DataTable
                            columns={columns}
                            data={clients.items}
                            getRowId={clientRowId}
                            isRowSelected={(client) => opened?.uuid === client.uuid}
                            renderMobileRow={(client) => <ClientMobileRow client={client} onOpen={(opener) => open(client, opener)} />}
                            itemLabel={CLIENTS_LABEL}
                            serverPagination={{
                                pageIndex: clients.meta.currentPage - 1,
                                pageCount: clients.meta.lastPage,
                                // El backend no dice cuántos van por página: sin eso, el rango
                                // «Mostrando X–Y» sería una cuenta inventada. El total ya está
                                // en la línea de la búsqueda; el pie dice la página.
                                total: null,
                                onPageChange: (index) => goTo(index + 1),
                                loading: paging,
                            }}
                            empty={
                                <EmptyState
                                    icon={Building2}
                                    title={query ? "Ningún cliente coincide con la búsqueda" : "Todavía no hay clientes"}
                                    description={query ? "Prueba con el correo, la identificación o el nombre de uno de sus usuarios." : undefined}
                                />
                            }
                        />
                    </div>
                )}
            </SectionCard>

            <ClientUsersDrawer client={opened} onClose={() => setOpened(null)} returnFocusTo={() => opener} />
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
    if (count == null) return <AbsentValue />
    return <StatusPill tone={count === 0 ? "idle" : "info"}>{usersCountLabel(count)}</StatusPill>
}

const CLIENTS_LABEL = { singular: "cliente", plural: "clientes" }
const clientRowId = (client: SupportClient) => client.uuid

/**
 * Las columnas de la tabla. Una sola acción explícita («Ver usuarios»): la fila
 * entera clicable duplicaba la interacción y complicaba el teclado y los
 * lectores de pantalla. Un cliente sin usuarios sigue legible, solo sin la
 * acción. Se arman una vez por `open` estable del componente.
 */
function clientColumns(open: (client: SupportClient, opener: HTMLElement) => void): ColumnDef<SupportClient>[] {
    return [
        {
            id: "name",
            header: "Cliente",
            meta: { sticky: "left" },
            cell: ({ row }) => <IdentityCell name={row.original.name} className="max-w-72" />,
        },
        {
            id: "email",
            header: "Correo",
            cell: ({ row }) => row.original.email
                ? <span className="block max-w-64 truncate text-sm text-ink-2">{row.original.email}</span>
                : <AbsentValue />,
        },
        {
            id: "identification",
            header: "Identificación",
            cell: ({ row }) => row.original.identificationNumber
                ? <span className="tabular-nums text-ink-2">{row.original.identificationNumber}</span>
                : <AbsentValue />,
        },
        { id: "users", header: "Usuarios", cell: ({ row }) => <UsersCountPill count={row.original.usersCount} /> },
        {
            id: "actions",
            header: () => <ActionsHeader />,
            meta: { cellClassName: "text-right" },
            cell: ({ row }) => <OpenUsersButton client={row.original} onOpen={(opener) => open(row.original, opener)} />,
        },
    ]
}

/** La misma información en la fila apilada de móvil. */
function ClientMobileRow({ client, onOpen }: { client: SupportClient; onOpen: (opener: HTMLElement) => void }) {
    return (
        <div className="space-y-2">
            <IdentityCell name={client.name} secondary={client.email ?? undefined} />
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                {client.identificationNumber && <span className="tabular-nums">ID {client.identificationNumber}</span>}
                <UsersCountPill count={client.usersCount} />
            </p>
            <OpenUsersButton client={client} onOpen={onOpen} className="h-10 w-full" />
        </div>
    )
}
