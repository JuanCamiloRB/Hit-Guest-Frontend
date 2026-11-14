"use client"

import * as React from "react"
import { Mail, User, Building2, ArrowLeft, CheckCircle2, MapPin, Gift } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Note } from "@/components/ui/note"
import { ReadOnlyField } from "@/components/ui/read-only-field"
import { CheckboxField } from "@/components/ui/checkbox-field"
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
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"

/** PM/Client account terms hosted by HIT outside this app (hitguest.com root, per Ricardo/Didier thread 20260801). */
const ACCOUNT_TERMS_URL = "https://hitguest.com/terminos-condiciones/"

type UserRegisterFormProps = React.HTMLAttributes<HTMLDivElement>

export function RegisterForm({ className, ...props }: UserRegisterFormProps) {
    const {
        form,
        isLoading,
        isSuccess,
        registeredEmail,
        onRegister,
        honeypotProps,
    } = useRegister()

    const successHeadingRef = React.useRef<HTMLHeadingElement>(null)
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

    React.useEffect(() => {
        if (isSuccess) successHeadingRef.current?.focus()
    }, [isSuccess])

    if (isSuccess) {
        return (
            <div className="grid gap-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center gap-3">
                    <IconBadge icon={CheckCircle2} tone="success" size="md" />
                    <div className="space-y-1">
                        <Heading level={2} size="page" className="outline-none" ref={successHeadingRef} tabIndex={-1}>
                            ¡Bienvenido a HIT Guest!
                        </Heading>
                        <p className="text-sm leading-relaxed text-ink-2">
                            Tu cuenta ya está creada. Te enviamos un correo de bienvenida.
                        </p>
                    </div>
                    <ReadOnlyField label="Correo de la cuenta" value={registeredEmail} locked={false} className="w-full text-left" />
                </div>

                <div className="grid gap-2">
                    {/* Un enlace, no un botón con `window.location`: el alta no deja
                        sesión iniciada, así que esto es una navegación normal y el
                        usuario puede abrirla en otra pestaña si quiere. */}
                    <Button variant="secondary" size="lg" asChild>
                        <Link href="/login">Iniciar sesión</Link>
                    </Button>
                    {/* El código de acceso lo emite el login, no el registro. Decirlo
                        acá evita que alguien vuelva a esperar un código del alta. */}
                    <p className="text-xs leading-relaxed text-ink-3">
                        Al iniciar sesión te enviaremos un código de 6 dígitos a ese correo.
                    </p>
                </div>

                <p className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary">
                    <Icon icon={Gift} />
                    Tu cuenta inicia con USD 10 de saldo de bienvenida.
                </p>
            </div>
        )
    }

    const isCompany = form.watch("person_type_id") === "2"

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            <Form {...form}>
                <form onSubmit={onRegister}>
                    <Honeypot {...honeypotProps} />
                    <Surface className="grid gap-5 p-6 relative">

                        {/* Welcome credit — the backend credits USD 10 to every new account. */}
                        <Note as="div" tone="accent" density="default" className="flex items-center gap-3">
                            <IconBadge icon={Gift} tone="primary" size="sm" />
                            <p>
                                <span className="font-bold text-primary">USD 10 de regalo</span> — tu cuenta inicia con saldo de bienvenida para ejecutar tus primeras automatizaciones.
                            </p>
                        </Note>

                        <FormField
                            control={form.control}
                            name="person_type_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Perfil <span className="text-danger">*</span></FormLabel>
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
                                        <FormLabel>Razón Social (Nombre de la Empresa) <span className="text-danger">*</span></FormLabel>
                                            <div className="relative group">
                                                <Icon icon={Building2} className={cn("absolute left-3 top-3 transition-colors",
 form.formState.errors.companyName ?"text-danger":"text-secondary group-focus-within:text-secondary")} />
                                                <FormControl>
                                                    <Input
                                                    placeholder="Ej: Apartamentos del Mar SAS"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11"
                                                    {...field}
                                                />
                                                </FormControl>
                                            </div>
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
                                            <span className="text-danger"> *</span>
                                        </FormLabel>
                                            <div className="relative group">
                                                <Icon icon={User} className={cn("absolute left-3 top-3 transition-colors",
 form.formState.errors.name ?"text-danger":"text-secondary group-focus-within:text-secondary")} />
                                                <FormControl>
                                                    <Input
                                                    placeholder="Ej: Juan"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11"
                                                    {...field}
                                                />
                                                </FormControl>
                                            </div>
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
                                            <span className="text-danger"> *</span>
                                        </FormLabel>
                                            <div className="relative group">
                                                <Icon icon={User} className={cn("absolute left-3 top-3 transition-colors",
 form.formState.errors.lastname ?"text-danger":"text-secondary group-focus-within:text-secondary")} />
                                                <FormControl>
                                                    <Input
                                                    placeholder="Ej: Pérez"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11"
                                                    {...field}
                                                />
                                                </FormControl>
                                            </div>
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
                                        <FormLabel>Tipo de Identificación <span className="text-danger">*</span></FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full h-11">
                                                    <SelectValue placeholder="Selecciona el tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl shadow-sm border-rule">
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
                                        <FormLabel>Número de Identificación <span className="text-danger">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: 12345678"
                                                disabled={isLoading}
                                                className="h-11"
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
                                    <FormLabel>Correo electrónico <span className="text-danger">*</span></FormLabel>
                                        <div className="relative group">
                                            <Icon icon={Mail} className={cn("absolute left-3 top-3 transition-colors",
 form.formState.errors.email ?"text-danger":"text-secondary group-focus-within:text-secondary")} />
                                            <FormControl>
                                                <Input
                                                placeholder="nombre@empresa.com"
                                                type="email"
                                                disabled={isLoading}
                                                className="pl-9 h-11"
                                                {...field}
                                            />
                                            </FormControl>
                                        </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{isCompany ? "Teléfono de empresa" : "Teléfono"} <span className="text-danger">*</span></FormLabel>
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
                                    <FormLabel>País <span className="text-danger">*</span></FormLabel>
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
                                                <SelectTrigger className="w-full h-11">
                                                    <SelectValue placeholder="Selecciona un país" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl shadow-sm border-rule max-h-50">
                                                {countries.map((country) => (
                                                    <SelectItem key={country.id} value={country.id}>
                                                        {country.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                            <div className="relative group">
                                                <Icon icon={MapPin} className="absolute left-3 top-3 text-secondary group-focus-within:text-secondary transition-colors" />
                                                <FormControl>
                                                    <Input
                                                    placeholder="Ej: Colombia"
                                                    disabled={isLoading}
                                                    className="pl-9 h-11"
                                                    {...field}
                                                />
                                                </FormControl>
                                            </div>
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
                                        <FormLabel>Estado / Departamento <span className="text-danger">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Valle del Cauca"
                                                disabled={isLoading}
                                                className="h-11"
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
                                        <FormLabel>Ciudad <span className="text-danger">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: Cali"
                                                disabled={isLoading}
                                                className="h-11"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <CheckboxField
                            checked={acceptedTerms}
                            onCheckedChange={(value) => setAcceptedTerms(value === true)}
                            label="Acepto los Términos y Condiciones de HIT"
                            action={
                                <Button asChild variant="link" size="inline"><a
                                    href={ACCOUNT_TERMS_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Ver términos y condiciones
                                </a></Button>
                            }
                        />

                        <div className="pt-2">
                            <Button size="lg" type="submit" disabled={!acceptedTerms} className="w-full" loading={isLoading}>
                                Crear Cuenta
                            </Button>
                        </div>

                        <div className="pt-4 border-t border-rule/30 text-center">
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/login">
                                    <Icon icon={ArrowLeft} />
                                    Volver al inicio de sesión
                                </Link>
                            </Button>
                        </div>
                    </Surface>
                </form>
            </Form>
        </div>
    )
}
