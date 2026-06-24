"use client"

import { useState, useEffect, useCallback } from "react"
import { useFormContext } from "react-hook-form"
import { Sparkles, Loader2, AlertCircle } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { automationService } from "../services/automation-service"
import { listingsService } from "../services/listings-service"
import { AUTOMATION_DEFINITIONS } from "../data/automation-definitions"
import type { PropertyAutomation, Provider } from "../types/automation"
import { AutomationCard, type ListingMeta } from "./automations"

export function PropertiesAutomation() {
    const { watch } = useFormContext()
    const propertyUuid: string = watch("uuid") ?? ""

    const [automations, setAutomations] = useState<PropertyAutomation[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [listings, setListings] = useState<ListingMeta[]>([])
    const [loading, setLoading] = useState(false)

    // Load providers once (not bound to a specific property)
    useEffect(() => {
        automationService.listProviders({ statusProviderId: 8 })
            .then(setProviders)
            .catch(() => setProviders([]))
    }, [])

    // Load automations + listings in parallel when the property is known
    useEffect(() => {
        if (!propertyUuid) return
        setLoading(true)

        Promise.allSettled([
            automationService.listGlobal({ propertyUuid }),
            listingsService.listByProperty(propertyUuid),
        ]).then(([automationsResult, listingsResult]) => {
            setAutomations(
                automationsResult.status === "fulfilled" ? automationsResult.value : []
            )
            setListings(
                listingsResult.status === "fulfilled"
                    ? listingsResult.value.map((l: any) => ({
                        uuid: l.uuid,
                        name: l.name ?? "Unidad sin nombre",
                        internalName: l.internalName ?? l.internal_name ?? null,
                    }))
                    : []
            )
        }).finally(() => setLoading(false))
    }, [propertyUuid])

    const handleChanged = useCallback((updated: PropertyAutomation | null, order: number) => {
        setAutomations(prev => {
            if (!updated) return prev.filter(a => a.executionOrder !== order)
            const exists = prev.some(a => a.executionOrder === order)
            return exists
                ? prev.map(a => a.executionOrder === order ? updated : a)
                : [...prev, updated]
        })
    }, [])

    return (
        <div className="space-y-6">
            {/* Header */}
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

            {/* Guard: property not saved yet */}
            {!propertyUuid && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <AlertCircle size={18} className="text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">
                        Guarda la propiedad primero para poder gestionar las automatizaciones.
                    </p>
                </div>
            )}

            {/* Automation cards grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-sm">Cargando automatizaciones...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {AUTOMATION_DEFINITIONS.map(def => (
                        <AutomationCard
                            key={def.order}
                            definition={def}
                            automation={automations.find(a => a.executionOrder === def.order) ?? null}
                            propertyUuid={propertyUuid}
                            providers={providers}
                            listings={listings}
                            onChanged={updated => handleChanged(updated, def.order)}
                        />
                    ))}
                </div>
            )}

            {/* Custom automation CTA */}
            <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
                <CardContent className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Sparkles className="h-6 w-6 text-[var(--color-brand-purple)]" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">¿Necesitas una regla personalizada?</h4>
                        <p className="text-sm text-slate-500">
                            Contacta con nuestro equipo para crear flujos de trabajo a la medida de tu negocio.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 font-bold flex items-center gap-2">
                        Solicitar Automatización personalizada
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
