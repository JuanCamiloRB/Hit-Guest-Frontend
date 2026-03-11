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
import { User } from "../../auth/types"
import { useState } from "react"
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
    const { language, setLanguage } = useLanguageStore()

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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                                <FormLabel>Nombre completo</FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                        <Input placeholder="Juan Pérez" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                    </div>
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
                            <FormLabel>Correo Electrónico</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                    <Input placeholder="nombre@ejemplo.com" {...field} disabled className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
                                </div>
                            </FormControl>
                            <FormDescription>
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

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Dirección</FormLabel>
                            <FormControl>
                                <div className="relative group">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                    <Input placeholder="Calle 123 #45-67" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
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
                                        <Input placeholder="Bogotá" {...field} className="pl-9 focus-visible:ring-[var(--color-brand-blue)]" />
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

                <div className="space-y-3">
                    <FormLabel className="flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        Idioma de la Interfaz
                    </FormLabel>
                    <div className="flex gap-4">
                        <Button 
                            type="button" 
                            variant={language === 'es' ? 'default' : 'outline'}
                            onClick={() => setLanguage('es')}
                            className={language === 'es' ? 'bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20' : ''}
                        >
                            Español
                        </Button>
                        <Button 
                            type="button" 
                            variant={language === 'en' ? 'default' : 'outline'}
                            onClick={() => setLanguage('en')}
                            className={language === 'en' ? 'bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20' : ''}
                        >
                            English
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        El idioma se guarda automáticamente y se aplica a toda la aplicación.
                    </p>
                </div>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300"
                >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />}
                    Guardar Cambios
                </Button>
            </form>
        </Form>
    )
}
