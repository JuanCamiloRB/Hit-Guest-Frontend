"use client"

import { useId, useState } from "react"
import { Settings2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { FieldError, FieldHint } from "@/components/ui/form"
import type { AutomationDefinition, ProviderOption } from "../../types/automation"
import { readCredentialsScope, supportsListingCredentials } from "../../lib/credentials-scope"
import { ParameterField } from "./ParameterField"
import { TriggerConfigSection } from "./TriggerConfigSection"
import { FeedbackBanner } from "@/components/ui/feedback-banner"

interface Props {
    open: boolean
    onClose: () => void
    definition: AutomationDefinition
    provider: ProviderOption
    currentParameters: Record<string, unknown>
    onSave: (params: Record<string, unknown>) => void
    isSaving: boolean
    /** 422 del backend en `parameters.credentials_scope`, para mostrarlo junto al interruptor. */
    scopeError?: string | null
}

export function ConfigModal({
    open,
    onClose,
    definition,
    provider,
    currentParameters,
    onSave,
    isSaving,
    scopeError,
}: Props) {
    // AutomationCard mounts this modal only while it is open, so the initializer
    // receives a fresh snapshot every time. An effect that copied props into state
    // caused an avoidable second render and tripped React's set-state-in-effect rule.
    const [params, setParams] = useState<Record<string, unknown>>(() => currentParameters ?? {})

    // TRA y SIRE pueden tomar las credenciales de cada alojamiento (contrato 2026-11-10).
    const supportsScope = supportsListingCredentials(provider.value)
    const perListing = readCredentialsScope({ providerName: provider.value, parameters: params }) === "listing"
    const scopeId = useId()

    const handleSave = () => {
        // El modo viaja SIEMPRE explícito en TRA/SIRE: `configure` reemplaza solo
        // las claves que se envían, así que omitirlo no devolvería a «property».
        // Las credenciales de la propiedad no se borran al cambiar de modo: en
        // «listing» el backend no las usa y se conservan para volver.
        onSave(supportsScope ? { ...params, credentials_scope: perListing ? "listing" : "property" } : params)
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon icon={Settings2} size="lg" className="text-primary" />
                        Configurar: {definition.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-ink-3 mt-1">
                        Proveedor: <span className="font-semibold">{provider.label}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {supportsScope && (
                        <div className="flex items-start justify-between gap-4 rounded-lg border border-rule p-3">
                            <div className="space-y-1">
                                <Label htmlFor={`${scopeId}-switch`} className="text-sm font-semibold">
                                    Credenciales por alojamiento
                                </Label>
                                <FieldHint id={`${scopeId}-hint`} compact>
                                    Para edificios con apartamentos de dueños distintos. Cada alojamiento lleva sus
                                    propias credenciales; uno sin ellas no se reporta.
                                </FieldHint>
                                <FieldError id={`${scopeId}-error`} compact>{scopeError}</FieldError>
                            </div>
                            <Switch
                                id={`${scopeId}-switch`}
                                checked={perListing}
                                onCheckedChange={(on) => setParams(prev => ({ ...prev, credentials_scope: on ? "listing" : "property" }))}
                                aria-describedby={scopeError ? `${scopeId}-hint ${scopeId}-error` : `${scopeId}-hint`}
                                aria-invalid={scopeError ? true : undefined}
                                disabled={isSaving}
                            />
                        </div>
                    )}

                    {provider.parametersSchema.length === 0 ? (
                        <FeedbackBanner tone="info">
                            Este proveedor no requiere configuración adicional. Las credenciales son administradas por el equipo de HIT.
                        </FeedbackBanner>
                    ) : perListing ? (
                        <FeedbackBanner tone="info">
                            Las credenciales se cargan en cada alojamiento, en el panel de alojamientos de esta
                            tarjeta o en la pestaña Alojamientos. Un alojamiento sin credenciales no se reporta.
                        </FeedbackBanner>
                    ) : (
                        provider.parametersSchema.map(schema => (
                            <ParameterField
                                key={schema.key}
                                schema={schema}
                                value={params[schema.key]}
                                onChange={v => setParams(prev => ({ ...prev, [schema.key]: v }))}
                            />
                        ))
                    )}

                    <TriggerConfigSection
                        params={params}
                        setParams={setParams}
                        providerSlug={provider.value}
                        required
                    />
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={isSaving}>
                        Guardar Configuración
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
