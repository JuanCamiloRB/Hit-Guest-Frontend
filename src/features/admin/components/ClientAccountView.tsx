"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogIn, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { formatMoney } from "@/lib/money"
import { getErrorMessage } from "@/lib/notify-error"
import { adminService } from "../services/admin-service"
import type { AdminClient, AdminClientUser } from "../lib/admin-readers"
import { accountStatusMeta, dateTime, initialsOf, monthYear, roleLabel } from "../lib/admin-display"
import { ADMIN_CAPABILITIES, hasCapability } from "../lib/session-access"
import { StartImpersonationDialog, type ImpersonationTarget } from "./StartImpersonationDialog"

type LoadState =
    | { kind: "loading" }
    | { kind: "ready"; client: AdminClient; users: AdminClientUser[] }
    | { kind: "error"; message: string }

/**
 * La cuenta de un cliente vista por un superusuario: datos de la cuenta y sus
 * usuarios, con la entrada a la cuenta de cada uno. Las propiedades, reservas y
 * huéspedes NO se muestran acá a propósito: el directorio expone solo
 * metadatos (contrato pedido §0); esos datos se ven entrando a la cuenta.
 */
export function ClientAccountView({ clientUuid }: { clientUuid: string }) {
    const { user } = useAuth()
    const canEnter = hasCapability(user, ADMIN_CAPABILITIES.impersonateReadOnly)
    const canWrite = hasCapability(user, ADMIN_CAPABILITIES.impersonateFull)
    const [state, setState] = useState<LoadState>({ kind: "loading" })
    const [reloadKey, setReloadKey] = useState(0)
    const [target, setTarget] = useState<ImpersonationTarget | null>(null)

    useEffect(() => {
        let active = true
        Promise.all([adminService.getClient(clientUuid), adminService.listClientUsers(clientUuid)])
            .then(([client, users]) => { if (active) setState({ kind: "ready", client, users: users.items }) })
            .catch((error) => {
                if (active) setState({ kind: "error", message: getErrorMessage(error, "No se pudo cargar la cuenta del cliente.") })
            })
        return () => { active = false }
    }, [clientUuid, reloadKey])

    if (state.kind === "loading") return <LoadingState rows={5} label="Cargando cuenta" />

    if (state.kind === "error") {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm">
                <span className="text-red-700">{state.message}</span>
                <Button variant="outline" size="sm" onClick={() => { setState({ kind: "loading" }); setReloadKey((k) => k + 1) }}>
                    <RefreshCw size={14} className="mr-1.5" /> Reintentar
                </Button>
            </div>
        )
    }

    const { client, users } = state
    const status = accountStatusMeta(client.status)
    const since = monthYear(client.createdAt)
    const owner = users.find((u) => u.isAccountOwner) ?? null
    const toTarget = (u: AdminClientUser): ImpersonationTarget => ({
        uuid: u.uuid, name: u.name, email: u.email, isAccountOwner: u.isAccountOwner,
    })
    const counts = [
        { label: "Propiedades", value: client.counts.properties },
        { label: "Alojamientos", value: client.counts.listings },
        { label: "Reservas", value: client.counts.reservations },
        { label: "Usuarios", value: client.counts.users },
    ].filter((c) => c.value != null)

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <span aria-hidden className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 p-3 text-lg font-bold text-brand-purple">
                        {initialsOf(client.name)}
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                            <Link href="/dashboard/admin/clients" className="hover:underline">Clientes</Link> › {client.name}
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{client.name}</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            {since && <span>Cliente desde {since}</span>}
                            {client.balance && <span>· saldo {formatMoney(client.balance.amount, client.balance.currency)}</span>}
                            {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
                        </p>
                    </div>
                </div>
                {canEnter && owner && (
                    <Button className="h-11" onClick={() => setTarget(toTarget(owner))}>
                        <LogIn className="mr-2 h-4 w-4" aria-hidden /> Entrar como el dueño
                    </Button>
                )}
            </header>

            {counts.length > 0 && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {counts.map((c) => (
                        <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">{c.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <SectionCard
                flush
                title="Usuarios"
                description={canEnter
                    ? "Entrar como un usuario te muestra exactamente lo que ese usuario ve y puede hacer. No pide código ni contraseña."
                    : "Tu cuenta no tiene permiso para entrar a cuentas de clientes."}
            >
                {users.length === 0 ? (
                    <EmptyState icon={<Users aria-hidden />} title="Esta cuenta no tiene usuarios" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                    <th scope="col" className="px-5 py-3 font-semibold">Usuario</th>
                                    <th scope="col" className="px-5 py-3 font-semibold">Rol</th>
                                    <th scope="col" className="px-5 py-3 font-semibold">Último acceso</th>
                                    <th scope="col" className="px-5 py-3"><span className="sr-only">Entrar</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const role = u.isAccountOwner ? "Dueño de la cuenta" : roleLabel(u.roles)
                                    const inactive = u.status != null && u.status.toLowerCase() !== "active"
                                    return (
                                        <tr key={u.uuid} className="border-t border-slate-100">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{u.name}</p>
                                                {u.email && <p className="text-xs text-slate-500">{u.email}</p>}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {role ? (
                                                    <StatusPill tone={u.isAccountOwner ? "info" : "idle"}>{role}</StatusPill>
                                                ) : "—"}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-700">{dateTime(u.lastLoginAt) ?? "—"}</td>
                                            <td className="px-5 py-3.5 text-right">
                                                {canEnter && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setTarget(toTarget(u))}
                                                        disabled={inactive}
                                                        aria-label={`Entrar como ${u.name}`}
                                                        title={inactive ? "Usuario inactivo" : `Entrar como ${u.name}`}
                                                        className={
                                                            "inline-flex h-11 w-11 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 "
                                                            + (u.isAccountOwner
                                                                ? "border-brand-purple bg-brand-purple text-white hover:opacity-90"
                                                                : "border-brand-purple/30 bg-white text-brand-purple hover:bg-brand-purple/5")
                                                        }
                                                    >
                                                        <LogIn size={18} aria-hidden />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <StartImpersonationDialog
                open={target !== null}
                onOpenChange={(open) => { if (!open) setTarget(null) }}
                target={target}
                clientName={client.name}
                canWrite={canWrite}
            />
        </div>
    )
}
