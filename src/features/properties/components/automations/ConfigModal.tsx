"use client"

import { useState } from "react"
import { Settings2, Loader2, AlertCircle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { AutomationDefinition, ProviderOption } from "../../types/automation"
import { ParameterField } from "./ParameterField"
import { TriggerConfigSection } from "./TriggerConfigSection"

interface Props {
    open: boolean
    onClose: () => void
    definition: AutomationDefinition
    provider: ProviderOption
    currentParameters: Record<string, unknown>
    onSave: (params: Record<string, unknown>) => void
    isSaving: boolean
}

export function ConfigModal({
    open,
    onClose,
    definition,
    provider,
    currentParameters,
    onSave,
    isSaving,
}: Props) {
    // AutomationCard mounts this modal only while it is open, so the initializer
    // receives a fresh snapshot every time. An effect that copied props into state
    // caused an avoidable second render and tripped React's set-state-in-effect rule.
    const [params, setParams] = useState<Record<string, unknown>>(() => currentParameters ?? {})

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 size={18} className="text-[var(--color-brand-purple)]" />
                        Configurar: {definition.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 mt-1">
                        Proveedor: <span className="font-semibold">{provider.label}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {provider.parametersSchema.length === 0 ? (
                        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl p-4">
                            <AlertCircle size={18} className="text-green-500 shrink-0" />
                            <p className="text-sm text-green-700">
                                Este proveedor no requiere configuración adicional. Las credenciales son administradas por el equipo de HIT.
                            </p>
                        </div>
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
                    <Button
                        onClick={() => onSave(params)}
                        disabled={isSaving}
                        className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white"
                    >
                        {isSaving && <Loader2 size={16} className="animate-spin mr-2" />}
                        Guardar Configuración
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
