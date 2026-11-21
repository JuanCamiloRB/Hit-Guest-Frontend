"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { ActionsHeader, IdentityCell, RowActionsMenu } from "@/components/shared/table-cells"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Crown, UserPlus, Trash2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { TEAM_ROLE_LABELS, type TeamRole, type User } from "@/features/auth/types"
import { userService } from "../services/user-service"
import { usersCache } from "../lib/users-cache"
import { useCachedLoad } from "@/hooks/useCachedLoad"
import { useAuthStore } from "@/lib/store/auth-store"
import { TransferOwnershipDialog } from "./TransferOwnershipDialog"
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
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { Heading } from "@/components/ui/heading"
import { LoadingState } from "@/components/ui/loading-state"

/**
 * Team users = CREATE + DELETE only. Editing a user is intentionally NOT offered:
 * changing a user's email effectively makes it a different identity, which would
 * require an OTP re-verification flow that doesn't exist yet (per backend). Owner
 * rules: only the account owner can create property_managers or delete users, and
 * the owner can't delete themselves (must transfer ownership first).
 */
const createSchema = z.object({
    firstName: z.string().min(2, "Nombre es requerido"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    role: z.enum(["property_manager", "property_staff", "read_only"] as [string, ...string[]]),
})

type UserFormValues = {
    firstName: string
    email: string
    password: string
    role: string
}

export function UserManagement() {
    const { user: currentUser } = useAuthStore()
    const setSession = useAuthStore((s) => s.setSession)
    const isOwner = !!currentUser?.isAccountOwner
    const meUuid = currentUser?.uuid ?? currentUser?.id
    const clientUuid =
        currentUser?.clientUuid ||
        (currentUser?.clientId && currentUser.clientId !== "CLT-001" ? currentUser.clientId : null)

    // La lista de la cuenta, con caché: volver a la pestaña la muestra al
    // instante y un fallo nunca la vacía.
    const { data, status, refreshFailed, errorMessage, refresh: fetchUsers } = useCachedLoad(usersCache)
    const users = useMemo(() => data ?? [], [data])
    const isLoading = status === "loading"
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transferOpen, setTransferOpen] = useState(false)

    const form = useForm<UserFormValues>({
        resolver: zodResolver(createSchema) as Resolver<UserFormValues>,
        defaultValues: { firstName: "", email: "", password: "", role: "property_staff" },
    })

    const handleDialogChange = (open: boolean) => {
        setIsDialogOpen(open)
        if (!open) form.reset({ firstName: "", email: "", password: "", role: "property_staff" })
    }

    // After a successful transfer the caller always stops being owner (they handed
    // it to someone else), so we flip the session flag directly — no extra fetch —
    // and refetch the list so the badges update.
    const handleTransferred = () => {
        if (currentUser) setSession({ ...currentUser, isAccountOwner: false })
        fetchUsers()
    }

    // Eligible new owners: every account user except the current owner (self).
    const transferCandidates = useMemo(() => users.filter((u) => u.id !== meUuid), [users, meUuid])

    // Available roles: property_manager only for the owner.
    const roleOptions = useMemo<TeamRole[]>(
        () => (isOwner ? ["property_manager", "property_staff", "read_only"] : ["property_staff", "read_only"]),
        [isOwner],
    )

    const onSubmit = async (data: UserFormValues) => {
        if (!clientUuid) {
            toast.error("No se pudo identificar la cuenta. Recarga la página.")
            return
        }
        setIsSubmitting(true)
        try {
            await userService.createUser({
                clientUuid,
                name: data.firstName,
                email: data.email,
                password: data.password,
                role: data.role as TeamRole,
            })
            toast.success("Usuario creado", {
                description: "Comparte la contraseña con el usuario; aún no hay invitación por correo.",
            })
            handleDialogChange(false)
            fetchUsers()
        } catch (error) {
            handleTeamError(error, "Error al crear el usuario")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (user: User) => {
        if (!confirm(`¿Eliminar a ${user.firstName} de la cuenta?`)) return
        try {
            await userService.deleteUser(user.id)
            // El servidor confirmó: la fila sale en el acto, y el refresco lo corrobora.
            usersCache.patch((list) => list.filter((u) => u.id !== user.id))
            toast.success("Usuario eliminado")
            fetchUsers()
        } catch (error) {
            handleTeamError(error, "Error al eliminar usuario")
        }
    }

    /**
     * 403 means the authenticated user lacks permission for this resource; it is
     * not an expired session. Keep a stable local message instead of coupling the
     * UI to the backend wording, which is localized through X-Locale.
     */
    const handleTeamError = (error: unknown, fallback: string) => {
        if (error instanceof ApiError) {
            if (error.status === 403) {
                toast.error("No tienes permiso para esta acción.")
                return
            }
            if (error.status === 422 && typeof error.message === "string" && error.message.trim()) {
                toast.error(error.message)
                return
            }
        }
        notifyError(error, fallback)
    }

    // Delete is shown only to the owner, never on their own row nor on another owner.
    const canDelete = (user: User) => isOwner && user.id !== meUuid && !user.isAccountOwner
    // Transfer is offered on the owner's OWN row (they hand ownership to someone else).
    const canTransferFrom = (user: User) => isOwner && user.id === meUuid && !!user.isAccountOwner

    // Cada fila lleva lo que se puede hacer con ella (depende de quién mira).
    const rows = useMemo<UserRow[]>(
        () => users.map((user) => ({ user, canDelete: canDelete(user), canTransfer: canTransferFrom(user) })),
        // `canDelete`/`canTransferFrom` solo leen `isOwner` y `meUuid`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [users, isOwner, meUuid],
    )
    // Columnas ESTABLES (TanStack monta cada celda como componente: una función
    // nueva por render remontaba la celda). Los manejadores cambian en cada
    // render: se leen de una ref, solo al pulsar.
    const handlersRef = useRef<UserRowHandlers>({ remove: () => {}, transfer: () => {} })
    useEffect(() => {
        handlersRef.current = { remove: handleDelete, transfer: () => setTransferOpen(true) }
    })
    const { columns, renderMobileRow } = useMemo(() => {
        const actions = (row: UserRow) => <UserActions row={row} handlersRef={handlersRef} />
        const columns: ColumnDef<UserRow>[] = [
            {
                id: "name",
                accessorFn: (row) => row.user.firstName,
                header: "Usuario",
                meta: { sticky: "left" },
                cell: ({ row }) => <IdentityCell name={row.original.user.firstName} secondary={row.original.user.email} className="max-w-72" />,
            },
            {
                id: "account",
                accessorFn: (row) => (row.user.isAccountOwner ? 0 : 1),
                header: "Cuenta",
                cell: ({ row }) => <AccountBadge user={row.original.user} />,
            },
            {
                id: "actions",
                header: () => <ActionsHeader />,
                enableSorting: false,
                meta: { headerClassName: "w-12", cellClassName: "text-center" },
                cell: ({ row }) => actions(row.original),
            },
        ]
        const renderMobileRow = (row: UserRow) => (
            <div className="flex items-start justify-between gap-3">
                <IdentityCell name={row.user.firstName} secondary={row.user.email} />
                <div className="flex shrink-0 items-center gap-2">
                    <AccountBadge user={row.user} />
                    {actions(row)}
                </div>
            </div>
        )
        return { columns, renderMobileRow }
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <Heading level={3}>Usuarios de la Cuenta</Heading>
                    <p className="text-sm text-ink-3">
                        Gestiona quién accede a esta cuenta y con qué rol.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
                    <DialogTrigger asChild>
                        <Button>
                            <Icon icon={UserPlus} className="mr-2" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-110">
                        <DialogHeader>
                            <DialogTitle>Invitar Usuario</DialogTitle>
                            <DialogDescription>
                                Se creará con la contraseña que definas (aún no hay invitación por correo).
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre completo</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Juan Pérez" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="usuario@empresa.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contraseña</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Rol asignado</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar rol" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {roleOptions.map((r) => (
                                                        <SelectItem key={r} value={r}>
                                                            {TEAM_ROLE_LABELS[r]}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {!isOwner && (
                                                <FormDescription className="text-xs">
                                                    Solo el dueño de la cuenta puede crear Administradores.
                                                </FormDescription>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit" loading={isSubmitting}>
                                        Crear Usuario
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {refreshFailed && (
                // Datos parciales (escala de estados): se ve la última lista cargada.
                <FeedbackBanner
                    tone="warning"
                    title="No pudimos actualizar la lista"
                    action={<Button variant="outline" size="sm" type="button" onClick={fetchUsers}>Reintentar</Button>}
                >
                    Se muestra la última cargada.
                </FeedbackBanner>
            )}

            {/* Role column intentionally omitted: the backend doesn't expose the role
                per user yet. Only the account-owner badge is available today. */}
            {isLoading ? (
                <LoadingState rows={3} label="Cargando usuarios" />
            ) : status === "error" ? (
                // Un fallo se dice: «no hay usuarios» sería falso.
                <FeedbackBanner
                    tone="danger"
                    mode="blocking"
                    title="No pudimos cargar los usuarios"
                    action={<Button variant="outline" size="sm" onClick={fetchUsers}>Reintentar</Button>}
                >
                    {/* El motivo del servidor (p. ej. un 403 por permisos), tal cual. */}
                    {errorMessage ?? "Revisa tu conexión e intenta de nuevo."}
                </FeedbackBanner>
            ) : (
                <DataTable
                    columns={columns}
                    data={rows}
                    getRowId={userRowId}
                    resetPageOn="users"
                    renderMobileRow={renderMobileRow}
                    itemLabel={USERS_LABEL}
                    defaultSorting={[{ id: "name", desc: false }]}
                    empty={<EmptyState title="Todavía no hay usuarios" description="Crea el primero con «Nuevo usuario»." />}
                />
            )}

            <TransferOwnershipDialog
                open={transferOpen}
                onOpenChange={setTransferOpen}
                clientUuid={clientUuid}
                candidates={transferCandidates}
                onTransferred={handleTransferred}
            />
        </div>
    )
}

const USERS_LABEL = { singular: "usuario", plural: "usuarios" }

interface UserRow {
    user: User
    canDelete: boolean
    canTransfer: boolean
}
interface UserRowHandlers {
    remove: (user: User) => void
    transfer: () => void
}
const userRowId = (row: UserRow) => row.user.id

function AccountBadge({ user }: { user: User }) {
    return user.isAccountOwner ? (
        <Badge tone="warning">
            <Icon icon={Crown} size="xs" /> Dueño de la cuenta
        </Badge>
    ) : (
        <Badge>Miembro</Badge>
    )
}

/** El menú «⋮» de la fila, como en todas las tablas; sin acciones posibles, el guion. */
function UserActions({ row, handlersRef }: { row: UserRow; handlersRef: React.RefObject<UserRowHandlers> }) {
    if (!row.canDelete && !row.canTransfer) return <span className="text-xs text-ink-4">—</span>
    return (
        <RowActionsMenu label={`Acciones de ${row.user.firstName}`}>
            {row.canTransfer && (
                <DropdownMenuItem onClick={() => handlersRef.current.transfer()}>
                    <Icon icon={Crown} /> Transferir propiedad de la cuenta
                </DropdownMenuItem>
            )}
            {row.canDelete && (
                <DropdownMenuItem className="text-danger" onClick={() => handlersRef.current.remove(row.user)}>
                    <Icon icon={Trash2} /> Eliminar
                </DropdownMenuItem>
            )}
        </RowActionsMenu>
    )
}
