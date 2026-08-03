"use client"

import * as React from "react"
import { Loader2, Mail, User, Building2, Phone, ArrowLeft, CheckCircle2, MapPin, Gift } from "lucide-react"
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
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { Honeypot } from "./Honeypot"
import Link from "next/link"

/** PM/Client account terms hosted by HIT outside this app (hitguest.com root, per Ricardo/Didier thread 20260801). */
const ACCOUNT_TERMS_URL = "https://hitguest.com/terminos-condiciones/"

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
    // No backend field for this — the account's own createdAt (set once
    // /register succeeds, which this gate blocks until checked) is the
    // acceptance timestamp, per Ricardo/Didier thread 20260801.
    const [acceptedTerms, setAcceptedTerms] = React.useState(false)
    const [personTypes, setPersonTypes] = React.useState<CatalogOption[]>([
        { id: "1", name: "Individual" },
        { id: "2", name: "Empresa (Negocio)" }
    ])
    const [identificationTypes, setIdentificationTypes] = React.useState<CatalogOption[]>([
        { id: "1", name: "Cédula de Ciudadanía" },
        { id: "2", name: "NIT" },
        { id: "3", name: "Cédula de Extranjería" },
        { id: "4", name: "Pasaporte" }
    ])
    const [countries, setCountries] = React.useState<CatalogOption[]>([])

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [types, idTypes, countryList] = await Promise.all([
                    catalogService.getPersonTypes(),
                    catalogService.getIdentificationTypes(),
                    catalogService.getCountries()
                ])

                if (types && types.length > 0) {
                    setPersonTypes(types)
                }
                
                if (idTypes && idTypes.length > 0) {
                    setIdentificationTypes(idTypes)
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
                    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-purple)]">
                        <Gift className="h-4 w-4" />
                        Tu cuenta inicia con USD 10 de saldo de bienvenida.
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
                    <h2 className="text-2xl font-semibold tracking-tight">Revisa tu correo</h2>
                    <p className="text-sm text-muted-foreground">
                        Enviamos un correo de confirmación a: <br />
                        <span className="font-medium text-foreground">{registeredEmail}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Haz clic en el botón de confirmación del correo. Después de aceptar recibirás
                        un código de verificación para ingresarlo aquí.
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

    const isCompany = form.watch("person_type_id") === "2"

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            <Form {...form}>
                <form onSubmit={onRegister}>
                    <Honeypot {...honeypotProps} />
                    <div className="grid gap-5 bg-card/80 backdrop-blur-sm border border-[var(--color-brand-blue)]/10 rounded-xl p-6 shadow-lg shadow-[var(--color-brand-blue)]/5 relative">
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-brand-blue)]/40 to-transparent rounded-t-xl" />

                        {/* Welcome credit — the backend credits USD 10 to every new account. */}
                        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-brand-purple)]/20 bg-[var(--color-brand-purple)]/5 px-4 py-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-purple)]/10">
                                <Gift className="h-4 w-4 text-[var(--color-brand-purple)]" />
                            </span>
                            <p className="text-sm text-slate-700">
                                <span className="font-bold text-[var(--color-brand-purple)]">USD 10 de regalo</span> — tu cuenta inicia con saldo de bienvenida para ejecutar tus primeras automatizaciones.
                            </p>
                        </div>

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

                        {isCompany && (
                            <FormField
                                control={form.control}
                                name="companyName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Razón Social (Nombre de la Empresa) <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Building2 className={cn(
                                                    "absolute left-3 top-3 h-4 w-4 transition-colors",
                                                    form.formState.errors.companyName ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                                )} />
                                                <Input
                                                    placeholder="Ej: Apartamentos del Mar SAS"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11 focus-visible:ring-[var(--color-brand-blue)]/30"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {isCompany ? "Nombre del Usuario Principal" : "Nombre"}
                                            <span className="text-destructive"> *</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <User className={cn(
                                                    "absolute left-3 top-3 h-4 w-4 transition-colors",
                                                    form.formState.errors.name ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                                )} />
                                                <Input
                                                    placeholder="Ej: Juan"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11 focus-visible:ring-[var(--color-brand-blue)]/30"
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
                                name="lastname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {isCompany ? "Apellido del Usuario Principal" : "Apellido"}
                                            <span className="text-destructive"> *</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <User className={cn(
                                                    "absolute left-3 top-3 h-4 w-4 transition-colors",
                                                    form.formState.errors.lastname ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                                )} />
                                                <Input
                                                    placeholder="Ej: Pérez"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11 focus-visible:ring-[var(--color-brand-blue)]/30"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                                                    <SelectItem key={type.id} value={type.id} className="cursor-pointer">
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
                                                "absolute left-3 top-3 h-4 w-4 transition-colors",
                                                form.formState.errors.email ? "text-destructive" : "text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)]"
                                            )} />
                                            <Input
                                                placeholder="nombre@empresa.com"
                                                type="email"
                                                disabled={isLoading}
                                                className="pl-9 h-11 focus-visible:ring-[var(--color-brand-blue)]/30"
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
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{isCompany ? "Teléfono de empresa" : "Teléfono"} <span className="text-destructive">*</span></FormLabel>
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
                                                    if (!currentPhone?.startsWith("+")) {
                                                        const cleanPrefix = prefix.startsWith("+") ? prefix : "+" + prefix
                                                        form.setValue("phone", `${cleanPrefix}${currentPhone || ""}`)
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
                                                    <SelectItem key={country.id} value={country.id}>
                                                        {country.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <FormControl>
                                            <div className="relative group">
                                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-[var(--color-brand-blue)]/60 group-focus-within:text-[var(--color-brand-blue)] transition-colors" />
                                                <Input
                                                    placeholder="Ej: Colombia"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11 rounded-lg border-slate-200 shadow-sm"
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
                                                className="h-11 rounded-lg border-slate-200 shadow-sm"
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
                                                className="h-11 rounded-lg border-slate-200 shadow-sm"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <label className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border/60 cursor-pointer hover:border-[var(--color-brand-purple)]/30 transition-colors">
                            <div className="relative flex items-center justify-center mt-0.5">
                                <input
                                    type="checkbox"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-2 focus:ring-[var(--color-brand-purple)]/20 checked:bg-[var(--color-brand-purple)] checked:border-[var(--color-brand-purple)] transition-all"
                                />
                                <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                            </div>
                            <span className="text-sm text-muted-foreground font-medium select-none">
                                Acepto los Términos y Condiciones de HIT —{" "}
                                <a
                                    href={ACCOUNT_TERMS_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[var(--color-brand-purple)] underline hover:no-underline"
                                >
                                    Ver términos y condiciones
                                </a>
                            </span>
                        </label>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={isLoading || !acceptedTerms}
                                className="w-full bg-[var(--color-brand-purple)] hover:bg-[#8b3ee0] text-primary-foreground font-bold shadow-md shadow-[var(--color-brand-purple)]/20 hover:shadow-lg hover:shadow-[var(--color-brand-purple)]/30 transition-all duration-300 h-11 rounded-lg"
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
