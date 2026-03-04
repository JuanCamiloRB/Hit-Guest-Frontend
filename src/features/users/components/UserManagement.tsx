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
    lastName: z.string().min(2, "Apellido es requerido"),
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
            lastName: "",
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
                lastName: "",
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
            lastName: user.lastName,
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
                lastName: data.lastName,
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
                        <Button className="bg-primary hover:bg-primary/90">
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
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="lastName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Apellido</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Teléfono / Whatsapp</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="+57 ..." {...field} />
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
                                                <FormLabel>Rol</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar rol" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {PREDEFINED_ROLES.filter(r => r.id !== "PRINCIPAL").map(role => (
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

                                <div className="grid grid-cols-2 gap-8 pt-4 border-t">
                                    <div className="space-y-4">
                                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground tracking-wider italic">
                                            Permisos Reservas
                                        </FormLabel>
                                        <div className="grid grid-cols-1 gap-y-2">
                                            {[
                                                { id: "READ", label: "Consultar" },
                                                { id: "CREATE", label: "Crear" },
                                                { id: "UPDATE", label: "Modificar" },
                                                { id: "DELETE", label: "Eliminar" }
                                            ].map((action) => (
                                                <FormField
                                                    key={action.id}
                                                    control={form.control}
                                                    name="permissions.reservations"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(action.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...field.value, action.id])
                                                                            : field.onChange(
                                                                                field.value?.filter(
                                                                                    (value) => value !== action.id
                                                                                )
                                                                            )
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal cursor-pointer">
                                                                {action.label}
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground tracking-wider italic">
                                            Permisos Propiedades
                                        </FormLabel>
                                        <div className="grid grid-cols-1 gap-y-2">
                                            {[
                                                { id: "READ", label: "Consultar" },
                                                { id: "CREATE", label: "Crear" },
                                                { id: "UPDATE", label: "Modificar" },
                                                { id: "DELETE", label: "Eliminar" }
                                            ].map((action) => (
                                                <FormField
                                                    key={action.id}
                                                    control={form.control}
                                                    name="permissions.properties"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(action.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...field.value, action.id])
                                                                            : field.onChange(
                                                                                field.value?.filter(
                                                                                    (value) => value !== action.id
                                                                                )
                                                                            )
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal cursor-pointer">
                                                                {action.label}
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isSubmitting}>
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
                                                <span className="font-medium">{user.firstName} {user.lastName}</span>
                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.isPrincipal ? "default" : "secondary"}>
                                                {PREDEFINED_ROLES.find(r => r.id === user.role)?.name || user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                Activo
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!user.isPrincipal && (
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
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(user.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
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
                                        <p className="font-medium">{user.firstName} {user.lastName}</p>
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
        </div>
    )
}
