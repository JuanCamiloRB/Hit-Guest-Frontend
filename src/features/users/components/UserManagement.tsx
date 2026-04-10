"use client"

import { useState, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    MoreHorizontal,
    Shield,
    UserPlus,
    Trash2,
    Loader2
} from "lucide-react"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { User, PREDEFINED_ROLES, UserRole } from "@/features/auth/types"
import { userService } from "../services/user-service"
import { useAuthStore } from "@/lib/store/auth-store"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

interface UserPermissions {
    reservations: string[]
    properties: string[]
}

const userSchema = z.object({
    firstName: z.string().min(2, "Nombre es requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().min(5, "Teléfono es requerido"),
    address: z.string().default(""),
    city: z.string().default(""),
    country: z.string().default(""),
    role: z.enum(["SECONDARY_MANAGER", "SECONDARY_STAFF", "VIEWER"] as [string, ...string[]]),
    permissions: z.object({
        reservations: z.array(z.string()).default(["READ"]),
        properties: z.array(z.string()).default(["READ"]),
    }).default({ reservations: ["READ"], properties: ["READ"] })
})

type UserFormValues = z.infer<typeof userSchema>

export function UserManagement() {
    const { user: currentUser } = useAuthStore()
    const [users, setUsers] = useState<User[]>([])
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema) as any,
        defaultValues: {
            firstName: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            country: "",
            role: "SECONDARY_STAFF",
            permissions: {
                reservations: ["READ"],
                properties: ["READ"]
            }
        },
    })

    const fetchUsers = async () => {
        setIsLoading(true)
        try {
            const data = await userService.getUsers()
            setUsers(data)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        if (!isDialogOpen) {
            setEditingUser(null)
            form.reset({
                firstName: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                country: "",
                role: "SECONDARY_STAFF",
                permissions: {
                    reservations: ["READ"],
                    properties: ["READ"]
                }
            })
        }
    }, [isDialogOpen, form])

    const handleEdit = (user: User) => {
        setEditingUser(user)
        form.reset({
            firstName: user.firstName,
            email: user.email,
            phone: user.phone || "",
            address: user.address || "",
            city: user.city || "",
            country: user.country || "",
            role: user.role as any,
            permissions: {
                reservations: user.permissions?.reservations || ["READ"],
                properties: user.permissions?.properties || ["READ"]
            }
        })
        setIsDialogOpen(true)
    }

    const onSubmit = async (data: UserFormValues) => {
        setIsSubmitting(true)
        try {
            const userData = {
                firstName: data.firstName,
                email: data.email,
                phone: data.phone,
                address: data.address,
                city: data.city,
                country: data.country,
                role: data.role as UserRole,
                clientId: currentUser?.clientId || "CLT-001",
                permissions: data.permissions
            }

            if (editingUser) {
                await userService.updateUser(editingUser.id, userData)
                toast.success("Usuario actualizado")
            } else {
                await userService.createUser(userData)
                toast.success("Usuario invitado", {
                    description: "Se ha enviado una invitación al correo electrónico."
                })
            }

            setIsDialogOpen(false)
            fetchUsers()
        } catch (error) {
            toast.error("Error al procesar la solicitud")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return
        try {
            await userService.deleteUser(id)
            toast.success("Usuario eliminado")
            fetchUsers()
        } catch (error) {
            toast.error("Error al eliminar usuario")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Usuarios Secundarios</h3>
                    <p className="text-sm text-muted-foreground">
                        Gestiona el acceso de tu equipo y asigna roles predefinidos.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingUser ? "Editar Usuario" : "Invitar Usuario"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingUser
                                    ? "Modifica los datos y permisos del usuario."
                                    : "Los usuarios secundarios tendrán acceso según el rol asignado."}
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="firstName"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
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
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Teléfono / Whatsapp</FormLabel>
                                                    <FormControl>
                                                        <PhoneInputField
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            placeholder="300 123 4567"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="role"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rol / Perfil</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={editingUser?.isPrincipal}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar rol" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {PREDEFINED_ROLES.map(role => (
                                                            <SelectItem key={role.id} value={role.id}>
                                                                {role.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Dirección</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ciudad</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="country"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>País</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="pt-4 border-t space-y-4">
                                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                                        <Shield className="h-4 w-4" />
                                        <span>Matriz de Permisos</span>
                                    </div>

                                    <div className="rounded-xl border bg-slate-50/50 overflow-hidden">
                                        <div className="grid grid-cols-5 bg-slate-100/80 border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground p-3">
                                            <div className="col-span-1">Módulo</div>
                                            <div className="text-center">Ver</div>
                                            <div className="text-center">Crear</div>
                                            <div className="text-center">Editar</div>
                                            <div className="text-center">Borrar</div>
                                        </div>

                                        <div className="divide-y divide-slate-100">
                                            {/* Reservations Row */}
                                            <div className="grid grid-cols-5 items-center p-3 hover:bg-white transition-colors">
                                                <div className="col-span-1 text-sm font-medium">Reservas</div>
                                                {["READ", "CREATE", "UPDATE", "DELETE"].map((action) => (
                                                    <div key={action} className="flex justify-center">
                                                        <FormField
                                                            control={form.control}
                                                            name="permissions.reservations"
                                                            render={({ field }) => (
                                                                <Checkbox
                                                                    disabled={editingUser?.isPrincipal}
                                                                    checked={field.value?.includes(action)}
                                                                    onCheckedChange={(checked) => {
                                                                        const newValue = checked
                                                                            ? [...(field.value || []), action]
                                                                            : field.value?.filter((v: string) => v !== action)
                                                                        field.onChange(newValue)
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Properties Row */}
                                            <div className="grid grid-cols-5 items-center p-3 hover:bg-white transition-colors">
                                                <div className="col-span-1 text-sm font-medium">Propiedades</div>
                                                {["READ", "CREATE", "UPDATE", "DELETE"].map((action) => (
                                                    <div key={action} className="flex justify-center">
                                                        <FormField
                                                            control={form.control}
                                                            name="permissions.properties"
                                                            render={({ field }) => (
                                                                <Checkbox
                                                                    disabled={editingUser?.isPrincipal}
                                                                    checked={field.value?.includes(action)}
                                                                    onCheckedChange={(checked) => {
                                                                        const newValue = checked
                                                                            ? [...(field.value || []), action]
                                                                            : field.value?.filter((v: string) => v !== action)
                                                                        field.onChange(newValue)
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic px-1">
                                        * Los usuarios principales tienen todos los permisos habilitados por defecto.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isSubmitting} className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300">
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingUser ? "Guardar Cambios" : "Crear Invitación"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="hidden md:table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No hay usuarios secundarios registrados.
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
                                            {user.phone ? (
                                                <a
                                                    href={`https://wa.me/${user.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-green-600 transition-colors group"
                                                >
                                                    <span className="h-5 w-5 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                                                        <svg className="h-3 w-3 fill-green-600" viewBox="0 0 24 24">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.001c6.536 0 11.871-5.335 11.874-11.892.003-3.176-1.233-6.162-3.483-8.411z" />
                                                        </svg>
                                                    </span>
                                                    {user.phone}
                                                </a>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">No asignado</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.isPrincipal ? "default" : "secondary"} className="font-medium">
                                                {PREDEFINED_ROLES.find(r => r.id === user.role)?.name || user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                Activo
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                        <Shield className="mr-2 h-4 w-4" /> Editar Usuario / Permisos
                                                    </DropdownMenuItem>
                                                    {!user.isPrincipal && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => handleDelete(user.id)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y">
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            No hay usuarios registrados.
                        </div>
                    ) : (
                        users.map((user) => (
                            <div key={user.id} className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium">{user.firstName}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                    {!user.isPrincipal && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(user.id)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={user.isPrincipal ? "default" : "secondary"}>
                                        {PREDEFINED_ROLES.find(r => r.id === user.role)?.name || user.role}
                                    </Badge>
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px]">
                                        Activo
                                    </Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div >
    )
}
