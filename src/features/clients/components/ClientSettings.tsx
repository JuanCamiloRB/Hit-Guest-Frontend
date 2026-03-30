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
import { catalogService, CatalogOption } from "../../auth/services/catalog-service"
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
    const [countries, setCountries] = useState<CatalogOption[]>([])

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
        async function fetchData() {
            try {
                const [clientData, countriesData] = await Promise.all([
                    clientService.getClient(clientId),
                    catalogService.getCountries()
                ])
                setClient(clientData)
                setCountries(countriesData)
                form.reset({
                    name: clientData.name,
                    taxId: clientData.taxId || "",
                    address: clientData.address || "",
                    city: clientData.city || "",
                    country: clientData.country || "",
                    phone: clientData.phone || "",
                    email: clientData.email || "",
                })
            } catch (error) {
                toast.error("Error al cargar los datos")
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-slate-900 font-bold">Nombre del Alojamiento / Empresa</FormLabel>
                            <FormControl>
                                <Input placeholder="Hotel ..." {...field} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)] focus-visible:border-[var(--color-brand-purple)]" />
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
                            <FormLabel className="text-slate-900 font-bold">NIT / RUT / Tax ID</FormLabel>
                            <FormControl>
                                <Input placeholder="900.123.456-1" {...field} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)] focus-visible:border-[var(--color-brand-purple)]" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-900 font-bold">Correo Institucional</FormLabel>
                                <FormControl>
                                    <Input placeholder="contacto@hotel.com" {...field} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)] focus-visible:border-[var(--color-brand-purple)]" />
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
                                <FormLabel className="text-slate-900 font-bold">Teléfono de Contacto</FormLabel>
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
                </div>

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-slate-900 font-bold">Dirección Principal</FormLabel>
                            <FormControl>
                                <Input placeholder="Calle ..." {...field} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)]" />
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
                                    <Input placeholder="Santa Marta" {...field} className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)]" />
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

                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                    <Button
                        type="submit"
                        disabled={isSaving}
                        className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-black uppercase tracking-widest px-8 md:w-auto w-full h-11 rounded-xl shadow-lg shadow-[var(--color-brand-purple)]/20 hover:shadow-xl hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300 transform active:scale-[0.98]"
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />}
                        Guardar Cambios del Alojamiento
                    </Button>
                </div>
            </form>
        </Form>
    )
}
