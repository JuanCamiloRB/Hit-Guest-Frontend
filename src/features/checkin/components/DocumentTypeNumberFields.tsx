"use client"

import { SearchableSelect } from "./SearchableSelect"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface Props {
    docTypeOptions: { id: number; label: string }[]
    documentType: number | ""
    onDocumentTypeChange: (value: number) => void
    documentNumber: string
    onDocumentNumberChange: (value: string) => void
}

/**
 * Shared "Tipo de documento" + "Número de documento" pair used by both the main
 * and secondary guest forms. Full-width, stacked: document type names
 * ("Cédula de Extranjería"…) need the room, and numbers can be long (passports).
 */
export function DocumentTypeNumberFields({
    docTypeOptions,
    documentType,
    onDocumentTypeChange,
    documentNumber,
    onDocumentNumberChange,
}: Props) {
    return (
        <>
            <SearchableSelect
                label="Tipo de documento"
                options={docTypeOptions}
                value={documentType}
                onChange={onDocumentTypeChange}
                placeholder="Seleccionar tipo..."
                required
            />
            <div className="space-y-1.5">
                <Label variant="plain" className="text-sm font-semibold text-ink-2">
                    Número de documento<span className="text-danger ml-0.5">*</span>
                </Label>
                <Input
                    type="text"
                    inputMode="numeric"
                    value={documentNumber}
                    onChange={(e) => onDocumentNumberChange(e.target.value)}
                    className="w-full bg-sunk/50 border border-rule rounded-xl px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="Ej. 1234567890"
                />
            </div>
        </>
    )
}
