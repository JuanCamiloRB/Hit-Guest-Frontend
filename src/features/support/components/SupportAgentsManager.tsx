"use client"

import { useEffect, useState } from "react"
import { Loader2, RefreshCw, UserPlus, UserX, Users } from "lucide-react"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingState } from "@/components/ui/loading-state"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { getErrorMessage } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { supportService } from "../services/support-service"
import type { PageMeta, SupportAgent } from "../lib/support-readers"
import { shortDate } from "../lib/support-display"

type AgentsState =
    | { kind: "loading" }
    | { kind: "ready"; items: SupportAgent[]; meta: PageMeta }
    | { kind: "error"; message: string }

type FieldErrors = { name?: string; email?: string; form?: string }

/** Errores de `POST /support/agents` (contrato §7): por campo, o un mensaje general. */
export function describeAgentCreateError(error: unknown): FieldErrors {
    if (error instanceof ApiError && error.status === 422) {
        const errors = error.errors && !Array.isArray(error.errors) ? error.errors : {}
        const first = (key: string) => {
            const messages = errors[key]
            return Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : undefined
        }
        const fields = { name: first("name"), email: first("email") }
        // `SUPPORT_INTERNAL_CLIENT_NOT_CONFIGURED` y cualquier 422 sin campo: el
        // `message` del backend (es configuración del backend, hay que avisarle).
        return fields.name || fields.email ? fields : { form: getErrorMessage(error, "No se pudo crear el agente.") }
    }
    return { form: getErrorMessage(error, "No se pudo crear el agente.") }
}

/** Alta, lista y revocación de agentes de soporte. Solo detrás de `SupportAccessGate requires="agents"`. */
export function SupportAgentsManager() {
    const [state, setState] = useState<AgentsState>({ kind: "loading" })
    const [page, setPage] = useState(1)
    const [reloadKey, setReloadKey] = useState(0)
    const [revoking, setRevoking] = useState<SupportAgent | null>(null)
    const [revokeBusy, setRevokeBusy] = useState(false)

    useEffect(() => {
        let active = true
        supportService.listAgents(page)
            .then((result) => { if (active) setState({ kind: "ready", items: result.items, meta: result.meta }) })
            .catch((error) => {
                if (active) setState({ kind: "error", message: getErrorMessage(error, "No se pudo cargar la lista de agentes.") })
            })
        return () => { active = false }
    }, [page, reloadKey])

    const reload = () => {
        setState({ kind: "loading" })
        setReloadKey((k) => k + 1)
    }

    const confirmRevoke = async () => {
        if (!revoking) return
        setRevokeBusy(true)
        try {
            await supportService.revokeAgent(revoking.uuid)
            toast.success(`${revoking.name} ya no tiene acceso a soporte`)
        } catch (error) {
            // 404 `SUPPORT_AGENT_NOT_FOUND`: ya no era agente; la lista se refresca igual.
            toast.error(getErrorMessage(error, "No se pudo revocar el acceso."))
        } finally {
            setRevokeBusy(false)
            setRevoking(null)
            reload()
        }
    }

    return (
        <div className="space-y-5">
            <CreateAgentForm onCreated={reload} />

            <SectionCard flush title="Agentes de soporte">
                {state.kind === "loading" && <LoadingState rows={4} label="Cargando agentes" />}
                {state.kind === "error" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm">
                        <span className="text-red-700">{state.message}</span>
                        <Button variant="outline" size="sm" onClick={reload}>
                            <RefreshCw size={14} className="mr-1.5" /> Reintentar
                        </Button>
                    </div>
                )}
                {state.kind === "ready" && state.items.length === 0 && (
                    <EmptyState icon={<Users aria-hidden />} title="Todavía no hay agentes de soporte" />
                )}
                {state.kind === "ready" && state.items.length > 0 && (
                    <>
                        <ul className="divide-y divide-slate-100">
                            {state.items.map((agent) => {
                                const since = shortDate(agent.createdAt)
                                const session = agent.activeSession
                                return (
                                    <li key={agent.uuid} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                                            <p className="truncate text-xs text-slate-500">
                                                {[agent.email, since ? `Alta: ${since}` : null].filter(Boolean).join(" · ")}
                                            </p>
                                            {session && (
                                                <div className="mt-1">
                                                    <StatusPill tone="warning">
                                                        En sesión: {session.clientName ?? "cliente"} como {session.userName ?? "usuario"}
                                                    </StatusPill>
                                                </div>
                                            )}
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setRevoking(agent)}>
                                            <UserX size={14} className="mr-1.5" aria-hidden /> Revocar
                                        </Button>
                                    </li>
                                )
                            })}
                        </ul>
                        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            <span>Página {state.meta.currentPage} de {state.meta.lastPage}</span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setState({ kind: "loading" }); setPage(page - 1) }}>
                                    Anterior
                                </Button>
                                <Button variant="outline" size="sm" disabled={page >= state.meta.lastPage} onClick={() => { setState({ kind: "loading" }); setPage(page + 1) }}>
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </SectionCard>

            <AlertDialog open={revoking !== null} onOpenChange={(open) => { if (!open && !revokeBusy) setRevoking(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Revocar el acceso de {revoking?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se cerrará su sesión de soporte abierta, si tiene una. El usuario no se borra: solo pierde el
                            acceso a soporte.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={revokeBusy}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={revokeBusy}
                            onClick={(event) => { event.preventDefault(); void confirmRevoke() }}
                        >
                            {revokeBusy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
                            Revocar acceso
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function CreateAgentForm({ onCreated }: { onCreated: () => void }) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<FieldErrors>({})

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setSaving(true)
        setErrors({})
        try {
            const agent = await supportService.createAgent({ name: name.trim(), email: email.trim() })
            toast.success(`${agent.name} ya es agente de soporte`, {
                description: "Entra con su correo y el código que le llega, como cualquier usuario.",
            })
            setName("")
            setEmail("")
            onCreated()
        } catch (error) {
            setErrors(describeAgentCreateError(error))
        } finally {
            setSaving(false)
        }
    }

    return (
        <SectionCard title="Dar de alta un agente" description="Si el correo ya existe en la cuenta interna de HIT, solo se le asigna el rol.">
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start" noValidate>
                <div className="space-y-1.5">
                    <Label htmlFor="agent-name">Nombre</Label>
                    <Input
                        id="agent-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={errors.name ? true : undefined}
                        className="h-11"
                    />
                    {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="agent-email">Correo</Label>
                    <Input
                        id="agent-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={errors.email ? true : undefined}
                        className="h-11"
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                </div>
                <Button type="submit" className="h-11 sm:mt-[22px]" disabled={saving}>
                    {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
                    Dar de alta
                </Button>
                {errors.form && (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3">
                        {errors.form}
                    </p>
                )}
            </form>
        </SectionCard>
    )
}
