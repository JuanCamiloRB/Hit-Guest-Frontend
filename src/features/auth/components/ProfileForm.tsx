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
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { useEffect, useState } from "react"
import { User } from "../../auth/types"
import { authService } from "@/features/auth/services/auth-service"
import { ApiError } from "@/types/api"
import { Loader2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { ClientLogoSection } from "./ClientLogoSection"

/**
 * "Mi cuenta" edits the CLIENTE record — the billable account created at
 * registration — NOT the signed-in user (users are managed in the Usuarios tab).
 * Field set mirrors the backend client model: person_type_id, name, lastname,
 * identification_type_id, identification_number, email, phone, address,
 * address_detail, city, state, country_id.
 */
const profileSchema = z.object({
    personTypeId: z.string().min(1, "Selecciona el tipo de perfil"),
    name: z.string().min(2, "Nombre es requerido"),
    lastname: z.string().default(""),
    identificationTypeId: z.string().min(1, "Selecciona el tipo de identificación"),
    identificationNumber: z.string().min(3, "El número es requerido").max(30),
    email: z.string().email(),
    phone: z.string().min(5, "Teléfono es requerido"),
    address: z.string().default(""),
    addressDetail: z.string().default(""),
    city: z.string().default(""),
    state: z.string().default(""),
    countryId: z.string().min(1, "País es requerido"),
}).superRefine((data, ctx) => {
    // Natural persons need a lastname; companies (type 2) don't have one.
    if (data.personTypeId !== "2" && data.lastname.trim().length < 2) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "El apellido es requerido",
            path: ["lastname"],
        })
    }
})

type ProfileValues = z.infer<typeof profileSchema>

interface ProfileFormProps {
    user: User
}

const inputClass =
    "h-11"
const selectClass =
    "h-11"

export function ProfileForm({ user }: ProfileFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isHydrating, setIsHydrating] = useState(true)
    // Client logo lives on the CLIENTE (used as PDF letterhead), edited via /clients/{uuid}/logo.
    const [clientUuid, setClientUuid] = useState<string | null>(null)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [countries, setCountries] = useState<any[]>([])
    const [personTypes, setPersonTypes] = useState<CatalogOption[]>([])
    const [identTypes, setIdentTypes] = useState<CatalogOption[]>([])
    // La cuenta no se pudo leer (fallo, no «sin cuenta»): no se muestra el
    // formulario, porque guardar pisaría la cuenta real con los valores de la sesión.
    const [accountError, setAccountError] = useState<string | null>(null)
    const [loadAttempt, setLoadAttempt] = useState(0)
    // Client uuid from the session (populated by GET /user at login). The legacy
    // "CLT-001" placeholder means we don't really have one → treat as absent.
    const sessionClientUuid =
        user.clientUuid || (user.clientId && user.clientId !== "CLT-001" ? user.clientId : null)

    const form = useForm<ProfileValues>({
        resolver: zodResolver(profileSchema) as any,
        defaultValues: {
            personTypeId: "1",
            name: user.firstName || "",
            lastname: "",
            identificationTypeId: "",
            identificationNumber: "",
            email: user.email || "",
            phone: user.phone || "",
            address: user.address || "",
            addressDetail: "",
            city: user.city || "",
            state: "",
            countryId: user.country || "",
        },
    })

    const isCompany = form.watch("personTypeId") === "2"

    // Catalogs + the client record. Without a client uuid in the session there
    // is no account to protect and the form uses the session user's data
    // (already in defaultValues). WITH one, the account must load: a failure
    // or an empty answer shows an error instead of a form that would save
    // the session defaults over the real account.
    useEffect(() => {
        let active = true
        // Un 401 ya está redirigiendo al login: no se muestra el error un instante.
        let redirecting = false
        ;(async () => {
            try {
                const [countryList, personList, identList, accountResult] = await Promise.all([
                    catalogService.getCountries().catch(() => []),
                    catalogService.getPersonTypes().catch(() => []),
                    catalogService.getIdentificationTypes().catch(() => []),
                    sessionClientUuid
                        ? authService.getClient(sessionClientUuid).then(
                            (value) => ({ ok: true as const, value }),
                            (error: unknown) => ({ ok: false as const, error }),
                        )
                        : Promise.resolve({ ok: true as const, value: null }),
                ])
                if (!active) return
                setCountries(countryList || [])
                setPersonTypes(personList || [])
                setIdentTypes(identList || [])
                if (!accountResult.ok) {
                    const { error } = accountResult
                    if (error instanceof ApiError && error.status === 401) {
                        redirecting = true
                        return
                    }
                    setAccountError(error instanceof Error && error.message ? error.message : "Intenta de nuevo en unos segundos.")
                    return
                }
                const account = accountResult.value
                if (sessionClientUuid && !account) {
                    setAccountError("La cuenta llegó vacía. Intenta de nuevo en unos segundos.")
                    return
                }
                setAccountError(null)
                setClientUuid(account?.uuid ?? sessionClientUuid)
                if (account) {
                    setLogoUrl(account.logoUrl)
                    const current = form.getValues()
                    form.reset({
                        ...current,
                        ...Object.fromEntries(
                            // Only override with non-empty backend values.
                            Object.entries(account.profile).filter(([, v]) => v !== "" && v != null)
                        ),
                        email: user.email || account.profile.email || current.email,
                    })
                }
            } finally {
                if (active && !redirecting) setIsHydrating(false)
            }
        })()
        return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadAttempt])

    async function onSubmit(data: ProfileValues) {
        if (!clientUuid) {
            toast.error("No se pudo identificar la cuenta", {
                description: "Recarga la página e intenta de nuevo.",
            })
            return
        }
        setIsLoading(true)
        try {
            // Mi cuenta edits the CLIENTE (not the session user) → PATCH /clients/{uuid}.
            await authService.updateProfile(clientUuid, {
                personTypeId: data.personTypeId,
                name: data.name,
                lastname: data.lastname,
                identificationTypeId: data.identificationTypeId,
                identificationNumber: data.identificationNumber,
                phone: data.phone,
                address: data.address,
                addressDetail: data.addressDetail,
                city: data.city,
                state: data.state,
                countryId: data.countryId,
            })
            toast.success("Cuenta actualizada", {
                description: "Los datos del cliente han sido guardados.",
            })
        } catch (error: any) {
            toast.error("No se pudo actualizar la cuenta", {
                description: error?.message ?? "Intenta de nuevo más tarde.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (isHydrating) {
        return (
            <div className="flex items-center justify-center py-16">
                <Icon icon={Loader2} size="xl" className="animate-spin text-primary" />
            </div>
        )
    }

    if (accountError) {
        // Sin una copia confiable de la cuenta no hay formulario: «Guardar»
        // enviaría los valores de la sesión encima de los datos reales.
        return (
            <div role="alert" className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="text-sm font-semibold text-ink">No pudimos cargar la cuenta</p>
                <p className="text-xs text-ink-3">{accountError}</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                        setIsHydrating(true)
                        setLoadAttempt((n) => n + 1)
                    }}
                >
                    Reintentar
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <ClientLogoSection clientUuid={clientUuid} initialLogoUrl={logoUrl} />

            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* [&>*]:min-w-0 lets every grid item shrink to its track — without it,
                    inputs keep their intrinsic width and overflow the card on the right. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 [&>*]:min-w-0">

                    {/* Identidad: Tipo de Perfil · Tipo de Documento · Número — a full-width
                        3-column row so nothing is crammed. min-w-0 lets the inputs shrink
                        within their tracks instead of overflowing the card. */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-6">
                        <FormField
                            control={form.control}
                            name="personTypeId"
                            render={({ field }) => (
                                <FormItem className="min-w-0">
                                    <FormLabel className="text-sm font-semibold text-ink-2">Tipo de Perfil</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                            <SelectTrigger className={selectClass}>
                                                <SelectValue placeholder="Selecciona el tipo" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {personTypes.map((t) => (
                                                    <SelectItem key={t.id} value={String(t.id)}>
                                                        {t.name}
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
                            name="identificationTypeId"
                            render={({ field }) => (
                                <FormItem className="min-w-0">
                                    <FormLabel className="text-sm font-semibold text-ink-2">Tipo de Documento</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                            <SelectTrigger className={selectClass}>
                                                <SelectValue placeholder="Selecciona" />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {identTypes.map((t) => (
                                                    <SelectItem key={t.id} value={String(t.id)}>
                                                        {t.name}
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
                                <FormItem className="min-w-0">
                                    <FormLabel className="text-sm font-semibold text-ink-2">
                                        N.º de Identificación
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. 1234567890" {...field} className={inputClass} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Nombre / Apellidos (o Razón Social para empresas) */}
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className={isCompany ? "col-span-1 md:col-span-2" : ""}>
                                <FormLabel className="text-sm font-semibold text-ink-2">
                                    {isCompany ? "Razón Social" : "Nombre"}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder={isCompany ? "Mi Empresa S.A.S." : "Juan Camilo"}
                                        {...field}
                                        className={inputClass}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {!isCompany && (
                        <FormField
                            control={form.control}
                            name="lastname"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-ink-2">Apellidos</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Rodríguez" {...field} className={inputClass} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {/* Email & Phone */}
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-ink-2">Correo Electrónico</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="nombre@ejemplo.com"
                                        {...field}
                                        disabled
                                        className="h-11 text-ink-3 cursor-not-allowed"
                                    />
                                </FormControl>
                                <FormDescription className="text-xs italic">
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
                                <FormLabel className="text-sm font-semibold text-ink-2">Teléfono / Whatsapp</FormLabel>
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

                    {/* Dirección + detalle */}
                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-ink-2">Dirección</FormLabel>
                                <FormControl>
                                    <Input placeholder="Calle 123 #45-67" {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="addressDetail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-ink-2">Detalle de Dirección</FormLabel>
                                <FormControl>
                                    <Input placeholder="Apto, oficina, torre… (opcional)" {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Ciudad / Estado / País */}
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-ink-2">Ciudad</FormLabel>
                                <FormControl>
                                    <Input placeholder="Bogotá" {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-ink-2">Estado / Departamento</FormLabel>
                                <FormControl>
                                    <Input placeholder="Cundinamarca" {...field} className={inputClass} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="countryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-semibold text-ink-2">País</FormLabel>
                                {/* Controlled so the label renders once the async list loads.
                                    FormControl va sobre el disparador: así la etiqueta nombra el combobox. */}
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={selectClass}>
                                            <SelectValue placeholder="Selecciona un país" />
                                        </SelectTrigger>
                                    </FormControl>
                                        <SelectContent>
                                            {countries.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="pt-4">
                    <Button size="lg"
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading && <Icon icon={Loader2} className="mr-2 animate-spin" />}
                        GUARDAR CAMBIOS
                    </Button>
                </div>
            </form>
            </Form>
        </div>
    )
}
