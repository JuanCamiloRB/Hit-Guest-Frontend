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
import { catalogService, CatalogOption } from "../../auth/services/catalog-service"
import { useEffect, useState } from "react"
import { User } from "../../auth/types"
import { Loader2, User as UserIcon, Mail, Phone, MapPin, Building, Globe, Languages } from "lucide-react"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { useLanguageStore } from "@/store/useLanguageStore"

const profileSchema = z.object({
    firstName: z.string().min(2, "Nombre es requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().min(5, "Teléfono es requerido"),
    address: z.string().default(""),
    city: z.string().default(""),
    country: z.string().default(""),
})

type ProfileValues = z.infer<typeof profileSchema>

interface ProfileFormProps {
    user: User
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [countries, setCountries] = useState<CatalogOption[]>([])
    const { language, setLanguage } = useLanguageStore()

    useEffect(() => {
        async function fetchCountries() {
            const data = await catalogService.getCountries()
            setCountries(data)
        }
        fetchCountries()
    }, [])

    const form = useForm<ProfileValues>({
        resolver: zodResolver(profileSchema) as any,
        defaultValues: {
            firstName: user.firstName,
            email: user.email,
            phone: user.phone || "",
            address: user.address || "",
            city: user.city || "",
            country: user.country || "",
        },
    })

    async function onSubmit(data: ProfileValues) {
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-slate-900 font-bold">Nombre Completo</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Juan Pérez"
                                    {...field}
                                    className="h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-[var(--color-brand-purple)] focus-visible:border-[var(--color-brand-purple)]"
                                />
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
                                <FormLabel className="text-slate-900 font-bold">Correo Electrónico</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        disabled
                                        className="h-11 bg-slate-50 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                                    />
                                </FormControl>
                                <p className="text-[11px] text-slate-500 italic px-1">
                                    El correo electrónico no se puede cambiar por seguridad.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
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
                                        placeholder="Bogotá"
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

                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-black uppercase tracking-widest px-8 md:w-auto w-full h-11 rounded-xl shadow-lg shadow-[var(--color-brand-purple)]/20 hover:shadow-xl hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300 transform active:scale-[0.98]"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />}
                        Guardar Cambios
                    </Button>
                </div>
            </form>
        </Form>
    )
}
