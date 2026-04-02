"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { catalogsService, CatalogOption } from "@/services/catalogs-service"
import { useEffect, useState } from "react"
import { User } from "../../auth/types"
import { Loader2, User as UserIcon, Mail, Phone, MapPin, Building, Globe, Languages } from "lucide-react"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { useLanguageStore } from "@/store/useLanguageStore"
import { cn } from "@/lib/utils"

const profileSchema = z.object({
    firstName: z.string().min(2, "Nombre es requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().min(5, "Teléfono es requerido"),
    address: z.string().optional().default(""),
    city: z.string().optional().default(""),
    country: z.string().min(1, "País es requerido"),
})

type ProfileValues = z.infer<typeof profileSchema>

interface ProfileFormProps {
    user: User
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [countries, setCountries] = useState<any[]>([])
    const { language, setLanguage } = useLanguageStore()

    const form = useForm<ProfileValues>({
        resolver: zodResolver(profileSchema) as any,
        defaultValues: {
            firstName: user.firstName || "",
            email: user.email || "",
            phone: user.phone || "",
            address: user.address || "",
            city: user.city || "",
            country: user.country || "",
        },
    })

    useEffect(() => {
        async function loadCountries() {
            const data = await catalogsService.getCountries()
            setCountries(data)
        }
        loadCountries()
    }, [])

    async function onSubmit(_data: ProfileValues) {
        setIsLoading(true)
        // Simulate update
        setTimeout(() => {
            setIsLoading(false)
            toast.success("Perfil actualizado", {
                description: "Tus datos han sido guardados correctamente.",
            })
        }, 1000)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    {/* Full width Name */}
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                                <FormLabel className="text-sm font-semibold text-slate-700">Nombre Completo</FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <Input 
                                            placeholder="Juan Camilo Rodríguez" 
                                            {...field} 
                                            className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-[var(--color-brand-purple)]/20 focus-visible:border-[var(--color-brand-purple)] transition-all rounded-xl" 
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Email & Phone */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-slate-700">Correo Electrónico</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="nombre@ejemplo.com" 
                                        {...field} 
                                        disabled 
                                        className="h-11 bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed rounded-xl" 
                                    />
                                </FormControl>
                                <FormDescription className="text-[10px] italic">
                                    El correo electrónico no se puede cambiar por seguridad.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-slate-700">Teléfono / Whatsapp</FormLabel>
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

                    {/* Address */}
                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                                <FormLabel className="text-sm font-semibold text-slate-700">Dirección</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Calle 123 #45-67" 
                                        {...field} 
                                        className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-[var(--color-brand-purple)]/20 focus-visible:border-[var(--color-brand-purple)] rounded-xl" 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* City & Country */}
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-slate-700">Ciudad</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Bogotá" 
                                        {...field} 
                                        className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-[var(--color-brand-purple)]/20 focus-visible:border-[var(--color-brand-purple)] rounded-xl" 
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
                                <FormLabel className="text-sm font-semibold text-slate-700">País</FormLabel>
                                <FormControl>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        defaultValue={field.value}
                                    >
                                        <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 focus:ring-[var(--color-brand-purple)]/20 rounded-xl">
                                            <SelectValue placeholder="Selecciona un país" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {countries.map((c) => (
                                                <SelectItem key={c.id} value={c.name}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="pt-4">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold h-11 px-8 rounded-xl shadow-md shadow-[var(--color-brand-purple)]/20 transition-all duration-300"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        GUARDAR CAMBIOS
                    </Button>
                </div>
            </form>
        </Form>
    )
}
