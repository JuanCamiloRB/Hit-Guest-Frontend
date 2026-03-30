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
import { catalogService, CatalogOption } from "../../auth/services/catalog-service"
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
    const [countries, setCountries] = useState<CatalogOption[]>([])
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
        const fetchData = async () => {
            await fetchUsers()
            try {
                const countriesData = await catalogService.getCountries()
                setCountries(countriesData)
            } catch (error) {
                console.error("Error fetching countries:", error)
            }
        }
        fetchData()
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Gestión de Equipo</h3>
                    <p className="text-sm text-slate-500">
                        Administra los usuarios secundarios y sus permisos.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-black uppercase tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-[var(--color-brand-purple)]/20 hover:shadow-xl transition-all duration-300">
                            <Plus className="mr-2 h-5 w-5" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                        <DialogHeader className="p-6 pb-0">
                            <DialogTitle className="text-2xl font-black text-slate-900">
                                {editingUser ? "Editar Usuario" : "Invitar Usuario"}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">
                                {editingUser
                                    ? "Modifica los datos y permisos del usuario."
                                    : "Los usuarios secundarios tendrán acceso según el rol asignado."}
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-5">
                                <div className="grid grid-cols-1 gap-5">
                                    <FormField
                                        control={form.control}
                                        name="firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-900 font-bold">Nombre completo</FormLabel>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <Input placeholder="Ej: Juan Pérez" {...field} className="h-11 rounded-xl border-slate-200 focus-visible:ring-[var(--color-brand-purple)] bg-slate-50/30" />
                                                    </div>
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
                                                <FormLabel className="text-slate-900 font-bold">Email</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="email@ejemplo.com" {...field} className="h-11 rounded-xl border-slate-200 focus-visible:ring-[var(--color-brand-purple)] bg-slate-50/30" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-900 font-bold">Teléfono / Whatsapp</FormLabel>
                                                <FormControl>
                                                    <PhoneInputField
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="300 123 4567"
                                                        className="h-11 rounded-xl"
                                                    />
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
                                                <FormLabel className="text-slate-900 font-bold">Rol / Perfil</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={editingUser?.isPrincipal}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/30 focus:ring-[var(--color-brand-purple)]">
                                                            <SelectValue placeholder="Seleccionar rol" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-slate-200">
                                                        {PREDEFINED_ROLES.map(role => (
                                                            <SelectItem key={role.id} value={role.id} className="rounded-lg">
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
                                            <FormLabel className="text-slate-900 font-bold">Dirección</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Calle 123 #45-67"
                                                    {...field}
                                                    className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)]"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-900 font-bold">Ciudad</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Santa Marta"
                                                        {...field}
                                                        className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)]"
                                                    />
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
                                                <FormLabel className="text-slate-900 font-bold">País</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl focus:ring-[var(--color-brand-purple)]">
                                                            <SelectValue placeholder="Selecciona un país" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl shadow-xl border-slate-100 max-h-[200px]">
                                                        {countries.map((country) => (
                                                            <SelectItem key={country.id} value={country.name} className="cursor-pointer focus:bg-[var(--color-brand-purple)]/5 transition-colors">
                                                                {country.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="pt-2 space-y-4">
                                    <div className="flex items-center gap-2 text-slate-900 font-black text-[10px] uppercase tracking-widest px-1">
                                        <Shield className="h-4 w-4 text-[var(--color-brand-purple)]" />
                                        <span>Matriz de Permisos</span>
                                    </div>

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 overflow-hidden shadow-inner">
                                        <div className="grid grid-cols-5 bg-white/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 p-3">
                                            <div className="col-span-1">Módulo</div>
                                            <div className="text-center">Ver</div>
                                            <div className="text-center">Crear</div>
                                            <div className="text-center">Editar</div>
                                            <div className="text-center">Borrar</div>
                                        </div>

                                        <div className="divide-y divide-slate-100">
                                            {[
                                                { id: "reservations", label: "Reservas" },
                                                { id: "properties", label: "Propiedades" }
                                            ].map((module) => (
                                                <div key={module.id} className="grid grid-cols-5 items-center p-3.5 hover:bg-white transition-colors">
                                                    <div className="col-span-1 text-sm font-bold text-slate-700">{module.label}</div>
                                                    {["READ", "CREATE", "UPDATE", "DELETE"].map((action) => (
                                                        <div key={action} className="flex justify-center">
                                                            <FormField
                                                                control={form.control}
                                                                name={`permissions.${module.id}` as any}
                                                                render={({ field }) => (
                                                                    <Checkbox
                                                                        disabled={editingUser?.isPrincipal}
                                                                        checked={(field.value as string[])?.includes(action)}
                                                                        onCheckedChange={(checked) => {
                                                                            const currentValue = (field.value as string[]) || []
                                                                            const newValue = checked
                                                                                ? [...currentValue, action]
                                                                                : currentValue.filter((v: string) => v !== action)
                                                                            field.onChange(newValue)
                                                                        }}
                                                                        className="h-5 w-5 rounded-md data-[state=checked]:bg-[var(--color-brand-purple)] data-[state=checked]:border-[var(--color-brand-purple)]"
                                                                    />
                                                                )}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic px-1 font-medium">
                                        * Los usuarios principales tienen todos los permisos habilitados por defecto.
                                    </p>
                                </div>
                                <DialogFooter className="pt-4">
                                    <Button type="submit" disabled={isSubmitting} className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-black uppercase tracking-widest w-full h-12 rounded-xl shadow-lg shadow-[var(--color-brand-purple)]/20 hover:shadow-xl transition-all duration-300">
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingUser ? "Guardar Cambios" : "Crear Invitación"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm shadow-slate-200/50 mt-4">
                <div className="overflow-x-auto">
                    <Table className="hidden md:table">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Usuario</TableHead>
                                <TableHead className="py-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Rol / Contacto</TableHead>
                                <TableHead className="py-4 font-black uppercase tracking-widest text-[10px] text-slate-400">Estado</TableHead>
                                <TableHead className="py-4 font-black uppercase tracking-widest text-[10px] text-slate-400 text-right pr-6">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--color-brand-purple)]" />
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-medium">
                                        No hay usuarios registrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((u) => {
                                    const roleInfo = PREDEFINED_ROLES.find(r => r.id === u.role)
                                    const roleName = roleInfo?.name || u.role
                                    
                                    // Custom badge colors
                                    const getRoleBadgeClasses = (roleId: string) => {
                                        if (u.isPrincipal) return "bg-[#1E1B4B] text-white border-none px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide"
                                        if (roleId === 'SECONDARY_MANAGER') return "bg-[#5467FA] text-white border-none px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide"
                                        if (roleId === 'SECONDARY_STAFF') return "bg-[var(--color-brand-purple)] text-white border-none px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide"
                                        return "bg-slate-100 text-slate-600 border-none px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wide"
                                    }

                                    return (
                                        <TableRow key={u.id} className="border-slate-100 hover:bg-slate-50/30 transition-colors">
                                            <TableCell className="py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-slate-900">{u.firstName}</span>
                                                    <span className="text-xs text-slate-400 font-medium lowercase tracking-tight">{u.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    {u.phone ? (
                                                        <a
                                                            href={`https://wa.me/${u.phone.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 group"
                                                        >
                                                            <div className="h-7 w-7 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                                                                <svg className="h-3.5 w-3.5 fill-green-600" viewBox="0 0 24 24">
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.001c6.536 0 11.871-5.335 11.874-11.892.003-3.176-1.233-6.162-3.483-8.411z" />
                                                                </svg>
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-500 group-hover:text-green-600 transition-colors">
                                                                {u.phone}
                                                            </span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 italic font-medium">No contact</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col gap-2">
                                                    <Badge className={getRoleBadgeClasses(u.role)}>
                                                        {roleName}
                                                        {u.isPrincipal && " (Admin)"}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center justify-end gap-3 pr-2">
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50/50 font-bold text-[10px] tracking-tight px-3 py-0.5 rounded-full">
                                                        Activo
                                                    </Badge>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100">
                                                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl">
                                                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Acciones</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleEdit(u)} className="rounded-lg mx-1 cursor-pointer">
                                                                <Shield className="mr-2 h-4 w-4 text-slate-400" /> 
                                                                <span className="font-bold text-slate-700">Editar Permisos</span>
                                                            </DropdownMenuItem>
                                                            {!u.isPrincipal && (
                                                                <>
                                                                    <DropdownMenuSeparator className="bg-slate-50" />
                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive rounded-lg mx-1 cursor-pointer"
                                                                        onClick={() => handleDelete(u.id)}
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" /> 
                                                                        <span className="font-bold">Eliminar</span>
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="p-8 text-center text-[var(--color-brand-purple)]">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 font-medium">
                            No hay usuarios registrados.
                        </div>
                    ) : (
                        users.map((u) => {
                            const roleInfo = PREDEFINED_ROLES.find(r => r.id === u.role)
                            const roleName = roleInfo?.name || u.role
                            
                            return (
                                <div key={u.id} className="p-5 space-y-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-0.5">
                                            <p className="font-bold text-slate-900">{u.firstName}</p>
                                            <p className="text-xs text-slate-400 font-medium">{u.email}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleEdit(u)}>
                                                <Shield className="h-4 w-4 text-slate-400" />
                                            </Button>
                                            {!u.isPrincipal && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(u.id)}
                                                    className="text-destructive h-8 w-8 rounded-full"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge className={
                                            u.isPrincipal ? "bg-[#1E1B4B] text-white border-none" :
                                            u.role === 'SECONDARY_MANAGER' ? "bg-[#5467FA] text-white border-none" :
                                            "bg-[var(--color-brand-purple)] text-white border-none"
                                        }>
                                            {roleName}
                                            {u.isPrincipal && " (Admin)"}
                                        </Badge>
                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50/50 text-[10px] font-bold px-2.5">
                                            Activo
                                        </Badge>
                                    </div>
                                    {u.phone && (
                                        <a
                                            href={`https://wa.me/${u.phone.replace(/\D/g, '')}`}
                                            className="inline-flex items-center gap-2 text-xs font-bold text-green-600 hover:text-green-700 bg-green-50/50 px-3 py-1.5 rounded-full transition-colors"
                                        >
                                            <svg className="h-3 w-3 fill-green-600" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.001c6.536 0 11.871-5.335 11.874-11.892.003-3.176-1.233-6.162-3.483-8.411z" />
                                            </svg>
                                            <span>WhatsApp: {u.phone}</span>
                                        </a>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div >
    )
}
