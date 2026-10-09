"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Building2, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { formatMoney } from "@/lib/money"
import { getErrorMessage } from "@/lib/notify-error"
import { adminService } from "../services/admin-service"
import type { AdminClient, PageMeta } from "../lib/admin-readers"
import { accountStatusMeta, initialsOf, monthYear } from "../lib/admin-display"

type LoadState =
    | { kind: "loading" }
    | { kind: "ready"; items: AdminClient[]; meta: PageMeta }
    | { kind: "error"; message: string }

/** Directorio de todas las cuentas de HitGuest. Solo se monta detrás de `AdminAccessGate`. */
export function ClientsDirectory() {
    const searchParams = useSearchParams()
    const [draft, setDraft] = useState("")
    const [query, setQuery] = useState("")
    const [page, setPage] = useState(1)
    const [reloadKey, setReloadKey] = useState(0)
    const [state, setState] = useState<LoadState>({ kind: "loading" })

    // El 401 de un token suplantado vencido trae de vuelta acá (api-client).
    useEffect(() => {
        if (searchParams.get("impersonation") === "ended") {
            toast.info("La sesión dentro de la cuenta terminó", {
                description: "Venció o fue revocada. Estás de vuelta en tu cuenta de superusuario.",
            })
        }
    }, [searchParams])

    useEffect(() => {
        let active = true
        adminService.listClients({ search: query, page })
            .then((result) => { if (active) setState({ kind: "ready", items: result.items, meta: result.meta }) })
            .catch((error) => {
                if (active) setState({ kind: "error", message: getErrorMessage(error, "No se pudo cargar el directorio de clientes.") })
            })
        return () => { active = false }
    }, [query, page, reloadKey])

    const search = (event: React.FormEvent) => {
        event.preventDefault()
        setState({ kind: "loading" })
        setPage(1)
        setQuery(draft)
    }

    const goTo = (next: number) => {
        setState({ kind: "loading" })
        setPage(next)
    }

    return (
        <div className="space-y-5">
            <form onSubmit={search} className="flex flex-wrap gap-3" role="search">
                <label htmlFor="client-search" className="sr-only">Buscar cliente</label>
                <div className="relative min-w-[260px] flex-1">
                    <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                        id="client-search"
                        type="search"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Buscar por cliente, dueño o correo…"
                        className="h-11 pl-9"
                    />
                </div>
                <Button type="submit" className="h-11">Buscar</Button>
            </form>

            <SectionCard flush title="Clientes" description="Entrar a una cuenta abre una sesión aparte: la tuya sigue abierta.">
                {state.kind === "loading" && <LoadingState rows={6} label="Cargando clientes" />}

                {state.kind === "error" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm">
                        <span className="text-red-700">{state.message}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setState({ kind: "loading" }); setReloadKey((k) => k + 1) }}
                        >
                            <RefreshCw size={14} className="mr-1.5" /> Reintentar
                        </Button>
                    </div>
                )}

                {state.kind === "ready" && state.items.length === 0 && (
                    <EmptyState
                        icon={<Building2 aria-hidden />}
                        title={query ? "Ningún cliente coincide con la búsqueda" : "Todavía no hay clientes"}
                    />
                )}

                {state.kind === "ready" && state.items.length > 0 && (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                        <th scope="col" className="px-5 py-3 font-semibold">Cliente</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Dueño de la cuenta</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Propiedades</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Usuarios</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Saldo</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">Estado</th>
                                        <th scope="col" className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {state.items.map((client) => {
                                        const status = accountStatusMeta(client.status)
                                        const since = monthYear(client.createdAt)
                                        return (
                                            <tr key={client.uuid} className="border-t border-slate-100">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10 text-xs font-bold text-brand-purple">
                                                            {initialsOf(client.name)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-slate-900">{client.name}</p>
                                                            {since && <p className="text-xs text-slate-500">Cliente desde {since}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-700">{client.owner?.email ?? "—"}</td>
                                                <td className="px-5 py-3.5">{client.counts.properties ?? "—"}</td>
                                                <td className="px-5 py-3.5">{client.counts.users ?? "—"}</td>
                                                <td className="px-5 py-3.5">
                                                    {client.balance ? formatMoney(client.balance.amount, client.balance.currency) : "—"}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : "—"}
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    <Link
                                                        href={`/dashboard/admin/clients/${encodeURIComponent(client.uuid)}`}
                                                        className="inline-flex h-9 items-center rounded-lg border border-brand-purple/30 px-3 text-xs font-semibold text-brand-purple hover:bg-brand-purple/5"
                                                    >
                                                        Ver cuenta
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            <span>
                                Página {state.meta.currentPage} de {state.meta.lastPage}
                                {state.meta.total != null ? ` · ${state.meta.total} clientes` : ""}
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                                    Anterior
                                </Button>
                                <Button variant="outline" size="sm" disabled={page >= state.meta.lastPage} onClick={() => goTo(page + 1)}>
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </SectionCard>
        </div>
    )
}
