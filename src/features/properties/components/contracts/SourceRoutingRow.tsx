"use client"

import { AlertCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DocumentEditor } from "../documents/DocumentEditor"
import { GuaranteePreview } from "./GuaranteePreview"
import {
    CONTRACT_TYPE_LABELS,
    CONTRACT_TYPE_OWNERS,
    isNativeSignatureAllowed,
    requiresAgreementDocument,
    requiresGuaranteeText,
    type ContractType,
    type SourceRouting,
} from "../../types/contract-routing"
import { providerSupportsContractType, type Provider } from "../../types/automation"

const CONTRACT_TYPES = Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]

interface Props {
    /** Display name for this channel — the source name, or "Todos los canales". */
    sourceLabel: string
    routing: SourceRouting
    onChange: (routing: SourceRouting) => void
    /** Active providers with signature capability (parameters.signature present). */
    providers: Provider[]
    text: string
    onTextChange: (text: string) => void
    shortcodes: string[]
    /** True when this channel needs agreement text but has none typed yet. */
    hasTextGap: boolean
    /** Only present in per_source mode, to drop this channel from by_source. */
    onRemove?: () => void
}

/**
 * One channel's full configuration: what gets signed (`contract_type`), who
 * signs it (`provider_slug`, filtered to what that contract_type allows), and
 * the contract text when applicable. Used both for the single "all" channel
 * (all_sources mode) and per-channel rows (per_source mode) — the caller
 * decides which, this component doesn't know about modes.
 */
export function SourceRoutingRow({
    sourceLabel,
    routing,
    onChange,
    providers,
    text,
    onTextChange,
    shortcodes,
    hasTextGap,
    onRemove,
}: Props) {
    const needsAgreement = requiresAgreementDocument(routing.contract_type)
    const needsGuarantee = requiresGuaranteeText(routing.contract_type)

    // Only providers that actually support the CHOSEN contract_type — read
    // from parameters.signature.contract_types, never hardcoded (backend plan §3.2).
    const availableProviders = providers.filter((p) => providerSupportsContractType(p, routing.contract_type))

    const handleContractTypeChange = (contract_type: ContractType) => {
        // A provider valid for the old contract_type may not be valid for the
        // new one (hitguest_signature only allows agreement_only) — clear it
        // instead of silently carrying over an invalid combination.
        const current = providers.find((p) => p.parameters.slug === routing.provider_slug)
        const stillValid = current && providerSupportsContractType(current, contract_type)
        onChange({
            contract_type,
            provider_slug: stillValid ? routing.provider_slug : "",
        })
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-800">{sourceLabel}</h4>
                {onRemove && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onRemove}
                        aria-label={`Quitar ${sourceLabel}`}
                        className="text-slate-400 hover:text-red-500"
                    >
                        <X size={14} />
                    </Button>
                )}
            </div>

            {/* contract_type */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Qué se firma</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CONTRACT_TYPES.map((type) => (
                        <button
                            key={type}
                            type="button"
                            aria-pressed={routing.contract_type === type}
                            onClick={() => handleContractTypeChange(type)}
                            className={cn(
                                "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors",
                                routing.contract_type === type
                                    ? "border-[var(--color-brand-purple)] bg-[var(--color-brand-purple)]/5 text-[var(--color-brand-purple)]"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300",
                            )}
                        >
                            <span className="block">{CONTRACT_TYPE_LABELS[type]}</span>
                            <span className="mt-0.5 block text-[10px] font-medium opacity-70">
                                {CONTRACT_TYPE_OWNERS[type]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* provider_slug */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quién firma</Label>
                <Select
                    value={routing.provider_slug || undefined}
                    onValueChange={(slug) => onChange({ ...routing, provider_slug: slug })}
                >
                    <SelectTrigger className="bg-slate-50 border-slate-200 max-w-xs">
                        <SelectValue placeholder="Selecciona el proveedor de firma" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableProviders.map((p) => (
                            <SelectItem key={p.parameters.slug} value={p.parameters.slug}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {!isNativeSignatureAllowed(routing.contract_type) && (
                    <p className="text-[11px] text-slate-400">
                        La garantía de daños solo puede firmarse con TuFirma por ahora.
                    </p>
                )}
            </div>

            {/* Agreement text */}
            {needsAgreement && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Texto del contrato
                    </Label>
                    {hasTextGap && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-600">
                            <AlertCircle size={13} /> Este canal necesita texto de contrato antes de guardar.
                        </p>
                    )}
                    <DocumentEditor value={text} onChange={onTextChange} shortcodes={shortcodes} />
                </div>
            )}

            {/* Guarantee preview */}
            {needsGuarantee && <GuaranteePreview />}
        </div>
    )
}
