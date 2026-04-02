"use client"

import * as React from "react"
import { Loader2, Mail, User, Building2, Phone, ArrowLeft, CheckCircle2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormLabel,
} from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useRegister } from "../hooks/use-register"
import { catalogsService as catalogService, CatalogOption } from "@/services/catalogs-service"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { Honeypot } from "./Honeypot"
import Link from "next/link"

type UserRegisterFormProps = React.HTMLAttributes<HTMLDivElement>

export function RegisterForm({ className, ...props }: UserRegisterFormProps) {
    const {
        form,
        isLoading,
        isAwaitingOtp,
        isSuccess,
        registeredEmail,
        onRegister,
        onVerifyOtp,
        onResendOtp,
        resetRegistration,
        honeypotProps,
    } = useRegister()

    const [otpValue, setOtpValue] = React.useState("")
    const [personTypes, setPersonTypes] = React.useState<CatalogOption[]>([
        { id: "1", name: "Individual" },
        { id: "2", name: "Empresa (Negocio)" }
    ])
    const [countries, setCountries] = React.useState<CatalogOption[]>([])

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [types, countryList] = await Promise.all([
                    catalogService.getPersonTypes(),
                    catalogService.getCountries()
                ])

                if (types && types.length > 0) {
                    setPersonTypes(types)

                    // Sync default if not found in fetched types
                    const currentTypeId = form.getValues("person_type_id")
                    if (!types.some(t => t.id === currentTypeId)) {
                        const bizType = types.find(t =>
                            t.name.toLowerCase().includes("empresa") ||
                            t.name.toLowerCase().includes("business") ||
                            t.name.toLowerCase().includes("jurídica") ||
                            t.name.toLowerCase().includes("juridica")
                        )
                        if (bizType) {
                            form.setValue("person_type_id", bizType.id)
                        } else if (types.length > 1) {
                            form.setValue("person_type_id", types[1].id) // Fallback to 2nd option
                        } else if (types.length > 0) {
                            form.setValue("person_type_id", types[0].id)
                        }
                    }
                }

                if (countryList && countryList.length > 0) {
                    setCountries(countryList)
                }
            } catch (error) {
                console.warn("Failed to fetch catalogs", error)
            }
        }
        fetchData()
    }, [])

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-12 w-12 rounded-full bg-[var(--color-brand-blue)]/10 flex items-center justify-center border border-[var(--color-brand-blue)]/20">
                    <CheckCircle2 className="h-6 w-6 text-[var(--color-brand-blue)]" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold">¡Cuenta Activada!</h3>
                    <p className="text-sm text-muted-foreground">
                        Tu registro se ha completado con éxito. Redirigiendo al dashboard...
                    </p>
                </div>
                <div className="w-full flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-blue)]" />
                </div>
            </div>
        )
    }

    if (isAwaitingOtp) {
        return (
            <div className="grid gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col space-y-2 text-center border-b pb-4">
                    <h2 className="text-2xl font-semibold tracking-tight">Verifica tu cuenta</h2>
                    <p className="text-sm text-muted-foreground">
                        Hemos enviado un código a: <br />
                        <span className="font-medium text-foreground">{registeredEmail}</span>
                    </p>
                    <button
                        onClick={resetRegistration}
                        className="text-xs text-[var(--color-brand-blue)] hover:underline mt-1"                    >
                        Cambiar correo / Reiniciar
                    </button>
                </div>

                <div className="grid gap-4">
                    <div className="space-y-2">
                        <Label>Código de 6 dígitos</Label>
                        <Input
                            placeholder="123456"
                            maxLength={6}
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value)}
                            disabled={isLoading}
                            className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                        />
                    </div>
                    <Button
                        disabled={isLoading || otpValue.length !== 6}
                        onClick={() => onVerifyOtp(otpValue)}
                        className="bg-[var(--color-brand-blue)] hover:bg-[#4a5be0] text-primary-foreground font-bold shadow-sm h-12"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Activar Cuenta e Iniciar Sesión
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                        ¿No recibiste el código?{" "}
                        <button
                            onClick={onResendOtp}
                            disabled={isLoading}
                            className="text-[var(--color-brand-blue)] hover:underline"
                        >
                            Reenviar (Mock)
                        </button>
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            <Form {...form}>
                <form onSubmit={onRegister}>
                    <Honeypot {...honeypotProps} />
                    <div className="grid gap-5 bg-card/80 backdrop-blur-sm border border-[var(--color-brand-blue)]/10 rounded-xl p-6 shadow-lg shadow-[var(--color-brand-blue)]/5 relative">
                        {/* Subtle top highlight for premium feel */}
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-brand-blue)]/40 to-transparent rounded-t-xl" />

                        <FormField
                            control={form.control}
                            name="person_type_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Perfil <span className="text-destructive">*</span></FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="w-full h-11">
                                                <SelectValue placeholder="Selecciona el tipo de perfil" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {personTypes.map((type) => (
                                                <SelectItem key={type.id} value={type.id}>
                                                    {type.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {form.watch("person_type_id") === "2" && (
                            <FormField
                                control={form.control}
                                name="companyName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Razón Social (Nombre de la Empresa)</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Building2 className={cn(
                                                    "absolute left-3 top-2.5 h-4 w-4 transition-colors",
                                                    form.formState.errors.companyName ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                                )} />
                                                <Input
                                                    placeholder="Ej: Apartamentos del Mar SAS"
                                                    disabled={isLoading}
                                                    className="pl-9 focus-visible:ring-[var(--color-brand-blue)]/30"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {form.watch("person_type_id") === "2"
<<<<<<< Updated upstream
                                                ? "Nombre del Usuario"
                                                : "Nombre completo"}
=======
                                                ? "Nombre del Usuario Principal"
                                                : "Nombre"}
                                            <span className="text-destructive"> *</span>
>>>>>>> Stashed changes
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <User className={cn(
                                                    "absolute left-3 top-2.5 h-4 w-4 transition-colors",
                                                    form.formState.errors.name ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                                )} />
                                                <Input
                                                    placeholder="Ej: Juan Pérez"
                                                    disabled={isLoading}
                                                    className="pl-9 focus-visible:ring-[var(--color-brand-blue)]/30"
                                                    {...field}
                                                />
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
                                        {countries.length > 0 ? (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Selecciona tu país" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {countries.map((country) => (
                                                        <SelectItem key={country.id} value={country.id}>
                                                            {country.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <FormControl>
                                                <div className="relative group">
<<<<<<< Updated upstream
                                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
=======
                                                    <User className={cn(
                                                        "absolute left-3 top-2.5 h-4 w-4 transition-colors",
                                                        form.formState.errors.lastname ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                                    )} />
>>>>>>> Stashed changes
                                                    <Input
                                                        placeholder="Ej: Colombia"
                                                        disabled={isLoading}
                                                        className="pl-9 focus-visible:ring-[var(--color-brand-blue)]/30"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
<<<<<<< Updated upstream
                                        )}
=======
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="identificationTypeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Identificación <span className="text-destructive">*</span></FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full h-11 rounded-lg border-slate-200 focus:ring-[var(--color-brand-blue)]/20 shadow-sm transition-all">
                                                    <SelectValue placeholder="Selecciona el tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl shadow-xl border-slate-100">
                                                {identificationTypes.map((type) => (
                                                    <SelectItem key={type.id} value={type.id} className="cursor-pointer focus:bg-[var(--color-brand-blue)]/5 transition-colors">
                                                        {type.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="identificationNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número de Identificación <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: 12345678"
                                                disabled={isLoading}
                                                className="h-11 rounded-lg border-slate-200 focus-visible:ring-[var(--color-brand-blue)]/20 shadow-sm transition-all"
                                                {...field}
                                            />
                                        </FormControl>
>>>>>>> Stashed changes
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
                                    <FormLabel>Correo electrónico <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <div className="relative group">
                                            <Mail className={cn(
                                                "absolute left-3 top-2.5 h-4 w-4 transition-colors",
                                                form.formState.errors.email ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                            )} />
                                            <Input
                                                placeholder="nombre@empresa.com"
                                                type="email"
                                                disabled={isLoading}
                                                className="pl-9 focus-visible:ring-[var(--color-brand-blue)]/30"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-2">
<<<<<<< Updated upstream
                            <FormLabel>{form.watch("person_type_id") === "2" ? "Business phone" : "Phone"}</FormLabel>
=======
                            <FormLabel>{form.watch("person_type_id") === "2" ? "Teléfono de empresa" : "Teléfono"} <span className="text-destructive">*</span></FormLabel>
>>>>>>> Stashed changes
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <PhoneInputField
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="300 123 4567"
                                                disabled={isLoading}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
<<<<<<< Updated upstream
=======

                        <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>País <span className="text-destructive">*</span></FormLabel>
                                    {countries.length > 0 ? (
                                        <Select 
                                            onValueChange={(val) => {
                                                field.onChange(val)
                                                const selected = countries.find(c => c.id === val)
                                                const prefix = selected?.extra?.phone_prefix || selected?.extra?.dial_code || selected?.extra?.code
                                                if (prefix) {
                                                    const currentPhone = form.getValues("phone")
                                                    if (!currentPhone.startsWith("+")) {
                                                        form.setValue("phone", `${prefix.startsWith("+") ? prefix : "+" + prefix}${currentPhone}`)
                                                    }
                                                }
                                            }} 
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full h-11 rounded-lg border-slate-200 focus:ring-[var(--color-brand-blue)]/20 shadow-sm transition-all">
                                                    <SelectValue placeholder="Selecciona un país" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl shadow-xl border-slate-100 max-h-[200px]">
                                                {countries.map((country) => (
                                                    <SelectItem key={country.id} value={country.id} className="cursor-pointer focus:bg-[var(--color-brand-blue)]/5 transition-colors">
                                                        {country.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <FormControl>
                                            <div className="relative group">
                                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                                <Input
                                                    placeholder="Ej: Colombia"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11 rounded-lg border-slate-200 focus-visible:ring-[var(--color-brand-blue)]/20 shadow-sm transition-all"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="state"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estado / Departamento <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Valle del Cauca"
                                                disabled={isLoading}
                                                className="h-11 rounded-lg border-slate-200 focus-visible:ring-[var(--color-brand-blue)]/20 shadow-sm transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ciudad <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Cali"
                                                disabled={isLoading}
                                                className="h-11 rounded-lg border-slate-200 focus-visible:ring-[var(--color-brand-blue)]/20 shadow-sm transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
>>>>>>> Stashed changes
                        <div className="pt-2">
                            <Button
                                disabled={isLoading}
                                className="w-full bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300 h-11 rounded-lg border border-transparent"
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />}
                                Crear Cuenta
                            </Button>
                        </div>

                        <div className="pt-4 border-t border-border/40 text-center">
                            <Link href="/login" className="inline-flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors hover:underline">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Volver al inicio de sesión
                            </Link>
                        </div>
                    </div>
                </form>
            </Form>
        </div>
    )
}
