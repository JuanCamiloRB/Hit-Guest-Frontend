"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { catalogsService as catalogService, CatalogOption } from "@/services/catalogs-service"
import { useEffect, useState } from "react"
import { Loader2, Building2, CreditCard, Mail, Phone, MapPin, Building, Globe } from "lucide-react"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { clientService } from "../services/client-service"
import { Client } from "@/features/auth/types"

const clientSchema = z.object({
    name: z.string().min(2, "El nombre es requerido"),
    taxId: z.string().min(5, "El NIT/RUT es requerido"),
    address: z.string().min(5, "La dirección es requerida"),
    city: z.string().min(2, "La ciudad es requerida"),
    country: z.string().min(2, "El país es requerido"),
    phone: z.string().min(5, "El teléfono es requerido"),
    email: z.string().email("Email inválido"),
})

interface ClientFormValues {
    name: string
    taxId: string
    address: string
    city: string
    country: string
    phone: string
    email: string
}

interface ClientSettingsProps {
    clientId: string
}

export function ClientSettings({ clientId }: ClientSettingsProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [client, setClient] = useState<Client | null>(null)

    const form = useForm<ClientFormValues>({
        resolver: zodResolver(clientSchema) as any,
        defaultValues: {
            name: "",
            taxId: "",
            address: "",
            city: "",
            country: "",
            phone: "",
            email: "",
        },
    })

    useEffect(() => {
        async function fetchClient() {
            try {
                const data = await clientService.getClient(clientId)
                setClient(data)
                form.reset({
                    name: data.name,
                    taxId: data.taxId || "",
                    address: data.address || "",
                    city: data.city || "",
                    country: data.country || "",
                    phone: data.phone || "",
                    email: data.email || "",
                })
            } catch (error) {
                toast.error("Error al cargar los datos del hotel")
            } finally {
                setIsLoading(false)
            }
        }
        fetchClient()
    }, [clientId, form])

    async function onSubmit(data: ClientFormValues) {
        setIsSaving(true)
        try {
            await clientService.updateClient(clientId, data)
            toast.success("Información actualizada", {
                description: "Los datos del hotel han sido guardados correctamente.",
            })
        } catch (error) {
            toast.error("Error al guardar los cambios")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre del Alojamiento / Empresa</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                    <Input placeholder="Hotel ..." {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>NIT / RUT / Tax ID</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                    <Input placeholder="900.123.456-1" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Correo Institucional</FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                        <Input placeholder="contacto@hotel.com" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                    </div>
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
                                <FormLabel>Teléfono de Contacto</FormLabel>
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
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Dirección Principal</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                    <Input placeholder="Calle ..." {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ciudad</FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                        <Input placeholder="Santa Marta" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                    </div>
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
                                    <div className="relative group">
                                        <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                        <Input placeholder="Colombia" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300"
                >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />}
                    Guardar Cambios del Alojamiento
                </Button>
            </form>
        </Form>
    )
}
