"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { FormInput } from "@/features/checkin/components/FormInput"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import { catalogService } from "@/features/auth/services/catalog-service"
import type { CheckinUserField } from "@/features/checkin/types/checkin"

interface DynamicCheckinFieldsProps {
    fields: CheckinUserField[]
    /** Current values keyed by the field's `key` (the exact `extra` key). */
    values: Record<string, string | number>
    onChange: (key: string, value: string | number) => void
}

/** Spanish labels for well-known provider keys; otherwise the key is humanized. */
const KNOWN_LABELS: Record<string, string> = {
    city_of_origin: "Ciudad de origen",
    city_of_residence: "Ciudad de residencia",
    city_destination: "Ciudad de destino",
    purpose_of_travel: "Motivo del viaje",
    reason_for_trip: "Motivo del viaje",
    accommodation_type: "Tipo de acomodación",
    accommodation_number: "Número de habitación",
    country_of_origin: "País de origen",
    country_destination: "País de destino",
}

function humanize(key: string): string {
    return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function fieldLabel(f: CheckinUserField): string {
    return f.label || KNOWN_LABELS[f.key] || humanize(f.key)
}

type SelectOptions = Array<{ id: number; label: string }>

/**
 * Renders provider-declared check-in fields (v4.6) dynamically from their descriptors.
 * - `text` / `number` → FormInput
 * - `select`          → SearchableSelect, options loaded from `catalogCategoryId`
 *
 * Values are stored under the field's exact `key` and submitted verbatim in `extra`,
 * so the backend receives precisely what the provider declared (no client-side mapping).
 */
export function DynamicCheckinFields({ fields, values, onChange }: DynamicCheckinFieldsProps) {
    const [optionsByCat, setOptionsByCat] = useState<Record<number, SelectOptions>>({})
    const [loadingCats, setLoadingCats] = useState(false)

    // Load catalog options for every distinct category referenced by select fields.
    const catIds = fields
        .filter((f) => f.type === "select" && f.catalogCategoryId != null)
        .map((f) => f.catalogCategoryId as number)
    const catKey = [...new Set(catIds)].sort().join(",")

    useEffect(() => {
        const ids = [...new Set(catIds)]
        if (ids.length === 0) return
        let active = true
        setLoadingCats(true)
        Promise.all(
            ids.map(async (id) => {
                const opts = await catalogService.getCatalogByCategoryId(id)
                return [id, opts.map((o) => ({ id: Number(o.id), label: o.name }))] as const
            })
        )
            .then((entries) => {
                if (!active) return
                setOptionsByCat((prev) => {
                    const next = { ...prev }
                    for (const [id, opts] of entries) next[id] = opts
                    return next
                })
            })
            .finally(() => {
                if (active) setLoadingCats(false)
            })
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catKey])

    if (fields.length === 0) return null

    return (
        <div className="space-y-4">
            {fields.map((f) => {
                const label = fieldLabel(f)

                if (f.type === "select") {
                    const options = (f.catalogCategoryId != null && optionsByCat[f.catalogCategoryId]) || []
                    if (loadingCats && options.length === 0) {
                        return (
                            <div key={f.key} className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    {label}
                                    {f.required && <span className="text-red-400 ml-0.5">*</span>}
                                </label>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-400">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-sm">Cargando opciones...</span>
                                </div>
                            </div>
                        )
                    }
                    const current = typeof values[f.key] === "number" ? (values[f.key] as number) : ""
                    return (
                        <SearchableSelect
                            key={f.key}
                            label={label}
                            options={options}
                            value={current}
                            onChange={(v) => onChange(f.key, v)}
                            placeholder="Seleccionar..."
                            required={f.required}
                        />
                    )
                }

                // text / number
                return (
                    <FormInput
                        key={f.key}
                        label={label}
                        value={values[f.key] != null ? String(values[f.key]) : ""}
                        onChange={(v) => onChange(f.key, v)}
                        placeholder={f.type === "number" ? "0" : ""}
                        type={f.type === "number" ? "number" : "text"}
                        required={f.required}
                    />
                )
            })}
        </div>
    )
}

/**
 * Provider-declared keys already collected by the hard-coded core form (document,
 * personal). The dynamic renderer skips these to avoid duplicate inputs.
 */
export const CORE_CHECKIN_FIELD_KEYS = new Set([
    "name", "lastname", "email", "phone",
    "date_of_birth", "dateOfBirth",
    "gender_id", "genderId",
    "nationality_id", "nationalityId",
    "identification_number", "identificationNumber",
    "identification_type_id", "identificationTypeId",
    "document_country_id", "documentCountryId",
])

/** Filters a schema's userFields down to the provider-specific (non-core) ones. */
export function getProviderUserFields(userFields?: CheckinUserField[]): CheckinUserField[] {
    return (userFields ?? []).filter((f) => !CORE_CHECKIN_FIELD_KEYS.has(f.key))
}

/** Whether all required dynamic fields have a non-empty value. */
export function areDynamicFieldsValid(
    fields: CheckinUserField[],
    values: Record<string, string | number>
): boolean {
    return fields.every((f) => {
        if (!f.required) return true
        const v = values[f.key]
        return v !== undefined && v !== null && String(v).trim() !== ""
    })
}
