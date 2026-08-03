"use client"

import { SearchableSelect } from "./SearchableSelect"

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
                <label className="text-sm font-semibold text-slate-700">
                    Número de documento<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={documentNumber}
                    onChange={(e) => onDocumentNumberChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                    placeholder="Ej. 1234567890"
                />
            </div>
        </>
    )
}
