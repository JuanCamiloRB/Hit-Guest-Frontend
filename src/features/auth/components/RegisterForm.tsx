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
import { catalogService, CatalogOption } from "../services/catalog-service"
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

    React.useEffect(() => {
        const fetchTypes = async () => {
            try {
                const types = await catalogService.getPersonTypes()
                if (types && types.length > 0) {
                    setPersonTypes(types)
                }
            } catch (error) {
                console.warn("Failed to fetch person types", error)
            }
        }
        fetchTypes()
    }, [])

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-12 w-12 rounded-full bg-caribbean-green/20 flex items-center justify-center border border-caribbean-green/30">
                    <CheckCircle2 className="h-6 w-6 text-caribbean-green" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold">¡Cuenta Activada!</h3>
                    <p className="text-sm text-muted-foreground">
                        Tu registro se ha completado con éxito. Redirigiendo al dashboard...
                    </p>
                </div>
                <div className="w-full flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-caribbean-green" />
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
                        className="text-xs text-caribbean-green hover:underline mt-1"
                    >
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
                        className="bg-caribbean-green hover:bg-caribbean-green/90 text-primary font-bold shadow-sm h-12"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Activar Cuenta e Iniciar Sesión
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                        ¿No recibiste el código?{" "}
                        <button
                            onClick={onResendOtp}
                            disabled={isLoading}
                            className="text-caribbean-green hover:underline"
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
                    <div className="grid gap-4">
                        <FormField
                            control={form.control}
                            name="person_type_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Perfil</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
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
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Ej: Apartamentos del Mar SAS"
                                                    disabled={isLoading}
                                                    className="pl-9"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Ej: Juan"
                                                disabled={isLoading}
                                                className="pl-9"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="lastname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apellido</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Ej: Perez"
                                                    disabled={isLoading}
                                                    className="pl-9"
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
                                        <FormControl>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Ej: Colombia"
                                                    disabled={isLoading}
                                                    className="pl-9"
                                                    {...field}
                                                />
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
                                    <FormLabel>Correo electrónico</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="nombre@empresa.com"
                                                type="email"
                                                disabled={isLoading}
                                                className="pl-9"
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
                                    <FormLabel>Teléfono / Whatsapp</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="+57 300 ..."
                                                disabled={isLoading}
                                                className="pl-9"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            disabled={isLoading}
                            className="bg-caribbean-green hover:bg-caribbean-green/90 text-primary font-bold shadow-sm"
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Cuenta
                        </Button>
                        <Link href="/login" className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al inicio de sesión
                        </Link>
                    </div>
                </form>
            </Form>
        </div>
    )
}
