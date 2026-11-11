"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { PhoneInputField } from "@/components/ui/phone-input-field"

import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import { useState } from "react"

const userSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    role: z.enum(["ADMIN", "STAFF"]),
    phone: z.string().optional(),
})

interface UserDialogProps {
    children?: React.ReactNode
    trigger?: React.ReactNode
}

export function UserDialog({ trigger }: UserDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof userSchema>>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: "",
            email: "",
            role: "STAFF",
            phone: "",
        },
    })

    async function onSubmit(values: z.infer<typeof userSchema>) {
        setIsLoading(true)
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false)
            setOpen(false)
            toast.success("Usuario creado", {
                description: `${values.name} ha sido añadido al equipo.`,
            })
            form.reset()
        }, 1000)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button>Add User</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-106.25">
                <DialogHeader>
                    <DialogTitle>Agregar Miembro del Equipo</DialogTitle>
                    <DialogDescription>
                        Crea un nuevo usuario y asigna un rol. Recibirán un correo para configurar su contraseña.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre completo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Juan Pérez" {...field} />
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
                                        <Input placeholder="john@hitguest.com" type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono (Opcional)</FormLabel>
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
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rol</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar un rol" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                            <SelectItem value="STAFF">Staff</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary text-primary-foreground font-bold shadow-sm hover:shadow-sm transition-all duration-300">
                                {isLoading && <Icon icon={Loader2} className="mr-2 animate-spin" />}
                                Crear Usuario
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
