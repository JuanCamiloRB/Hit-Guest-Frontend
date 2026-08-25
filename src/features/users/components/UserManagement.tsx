"use client"

import { useState, useEffect, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Crown, MoreHorizontal, UserPlus, Trash2, Loader2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TEAM_ROLE_LABELS, type TeamRole, type User } from "@/features/auth/types"
import { userService } from "../services/user-service"
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

    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [transferOpen, setTransferOpen] = useState(false)

    const form = useForm<UserFormValues>({
        resolver: zodResolver(createSchema) as Resolver<UserFormValues>,
        defaultValues: { firstName: "", email: "", password: "", role: "property_staff" },
    })

    const fetchUsers = async () => {
        try {
            setUsers(await userService.getUsers())
        } catch (error) {
            notifyError(error, "No se pudieron cargar los usuarios")
        } finally {
            setIsLoading(false)
        }
    }

    // Mount load via promise chain so setState runs in async callbacks (not
    // synchronously in the effect body — react-hooks/set-state-in-effect).
    useEffect(() => {
        let active = true
        userService.getUsers()
            .then((data) => { if (active) setUsers(data) })
            .catch((e) => { if (active) notifyError(e, "No se pudieron cargar los usuarios") })
            .finally(() => { if (active) setIsLoading(false) })
        return () => { active = false }
    }, [])

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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Usuarios de la Cuenta</h3>
                    <p className="text-sm text-muted-foreground">
                        Gestiona quién accede a esta cuenta y con qué rol.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
                    <DialogTrigger asChild>
                        <Button className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[440px]">
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
                                                <FormDescription className="text-[11px]">
                                                    Solo el dueño de la cuenta puede crear Administradores.
                                                </FormDescription>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold"
                                    >
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Crear Usuario
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Role column intentionally omitted: the backend doesn't expose the role
                per user yet. Only the account-owner badge is available today. */}
            <div className="rounded-md border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Cuenta</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No hay usuarios registrados en esta cuenta.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">{user.firstName}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {user.isAccountOwner ? (
                                            <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                                                <Crown className="h-3 w-3" /> Dueño de la cuenta
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500">Miembro</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canDelete(user) || canTransferFrom(user) ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    {canTransferFrom(user) && (
                                                        <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                                                            <Crown className="mr-2 h-4 w-4" /> Transferir propiedad de la cuenta
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDelete(user) && (
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(user)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

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
