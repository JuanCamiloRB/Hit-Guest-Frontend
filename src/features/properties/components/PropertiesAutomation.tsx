"use client"

import { useFormContext } from "react-hook-form"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    MessageSquare,
    Key,
    Shield,
    CheckCircle2,
    Send,
    Settings2,
    Clock,
    Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"

const automationRules = [
    {
        id: "welcome_message",
        title: "Mensaje de Bienvenida",
        description: "Enviar automáticamente un mensaje de bienvenida cuando se confirma la reserva.",
        icon: MessageSquare,
        color: "text-blue-500",
        bgColor: "bg-blue-50",
    },
    {
        id: "checkin_instructions",
        title: "Instrucciones de Check-in",
        description: "Enviar instrucciones detalladas y ubicación 24 horas antes de la llegada.",
        icon: Send,
        color: "text-emerald-500",
        bgColor: "bg-emerald-50",
    },
    {
        id: "digital_key",
        title: "Generación de Código",
        description: "Crear código de acceso único en la cerradura inteligente para cada huésped.",
        icon: Key,
        color: "text-amber-500",
        bgColor: "bg-amber-50",
    },
    {
        id: "online_checkin",
        title: "Check-in Online",
        description: "Solicitar registro de huéspedes y firma de contrato antes de la entrada.",
        icon: CheckCircle2,
        color: "text-indigo-500",
        bgColor: "bg-indigo-50",
    },
    {
        id: "cleaning_task",
        title: "Tarea de Limpieza",
        description: "Crear automáticamente una tarea de limpieza para el personal al finalizar la estancia.",
        icon: Shield,
        color: "text-fuchsia-500",
        bgColor: "bg-fuchsia-50",
    }
]

import { PropertyFormData } from "../types"

export function PropertiesAutomation() {
    const { control } = useFormContext<PropertyFormData>()

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-[var(--color-brand-purple)]/10 rounded-lg">
                            <Sparkles className="h-5 w-5 text-[var(--color-brand-purple)]" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
                            Reglas de Automatización
                        </CardTitle>
                    </div>
                    <CardDescription className="text-base text-slate-500">
                        Configura disparadores automáticos para mejorar la experiencia del huésped y agilizar tu operación.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                {automationRules.map((rule) => (
                    <Card key={rule.id} className="group overflow-hidden border-slate-200/60 hover:border-[var(--color-brand-purple)]/30 hover:shadow-md transition-all duration-300">
                        <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row items-stretch">
                                <div className={cn(
                                    "flex items-center justify-center w-full md:w-20 py-4 md:py-0 transition-colors",
                                    rule.bgColor
                                )}>
                                    <rule.icon className={cn("h-8 w-8", rule.color)} />
                                </div>
                                <div className="flex-1 p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-slate-900 leading-none">
                                                    {rule.title}
                                                </h3>
                                                <Badge variant="outline" className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold h-5">
                                                    Pro
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-500 leading-relaxed">
                                                {rule.description}
                                            </p>
                                        </div>
                                        <FormField
                                            control={control}
                                            name={`automationSettings.${rule.id}` as any}
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="data-[state=checked]:bg-[var(--color-brand-purple)]"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>Tiempo Real</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-[var(--color-brand-purple)] hover:text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/5 gap-1.5 px-3">
                                            <Settings2 className="h-3.5 w-3.5" />
                                            Configurar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
                <CardContent className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Sparkles className="h-6 w-6 text-[var(--color-brand-purple)]" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">¿Necesitas una regla personalizada?</h4>
                        <p className="text-sm text-slate-500">Contacta con nuestro equipo para crear flujos de trabajo a la medida de tu negocio.</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 font-bold flex items-center gap-2">
                        Solicitar Automatización personalizada
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
