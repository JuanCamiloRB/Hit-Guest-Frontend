"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Link2, Plus, Trash2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingState } from "@/components/ui/loading-state"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { cn } from "@/lib/utils"
import { EXTERNAL_ID_MAX_LENGTH } from "../lib/external-pms-ids"
import type { ExternalPmsId } from "../types"

/** Per-row validation messages, in the same order as `value`. */
export interface ExternalPmsIdRowError {
    sourcePmsId?: string
    externalId?: string
}

interface ExternalPmsIdsFieldProps {
    value: ExternalPmsId[]
    onChange: (next: ExternalPmsId[]) => void
    /** The noun this field is attached to, used in the copy. */
    subject: "propiedad" | "alojamiento"
    /**
     * Row-level errors to surface inline. The caller owns validation — the
     * property form gets these from zod, the unit dialog computes them on save —
     * so this component never has to know which one it is talking to.
     */
    rowErrors?: ExternalPmsIdRowError[]
    disabled?: boolean
    className?: string
}

/**
 * Registers where a manually created property/listing already exists outside
 * HitGuest: the origin (PMS or channel) plus the id it has there.
 *
 * Fully controlled — it owns no draft state of its own. That is what lets the
 * same component serve two very different callers: the property form, where the
 * value lives in a react-hook-form field, and the unit dialog, where it lives in
 * plain `useState`. Neither one has to know how the other stores it.
 *
 * The origin list comes from the `source_pms` catalog and is never hardcoded: if
 * it fails to load, the field says so and blocks adding new rows rather than
 * offering an id that could map the property to the wrong system.
 */
export function ExternalPmsIdsField({
    value,
    onChange,
    subject,
    rowErrors,
    disabled = false,
    className,
}: ExternalPmsIdsFieldProps) {
    const [sources, setSources] = useState<CatalogOption[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const baseId = useId()

    useEffect(() => {
        let mounted = true
        catalogService
            .getPmsSources()
            .then((options) => {
                if (mounted) setSources(options)
            })
            .finally(() => {
                if (mounted) setIsLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [])

    const rows = useMemo(() => value ?? [], [value])
    const catalogUnavailable = !isLoading && sources.length === 0

    /**
     * The catalog, plus a stand-in for any origin already saved on this record
     * that the catalog does not (or does not yet) list.
     *
     * Without this, a saved `sourcePmsId` with no matching option makes Radix
     * fall back to the placeholder — the PM's stored origin reads as blank and
     * looks lost, both while the catalog is still loading and permanently if it
     * fails or the entry gets deactivated. Showing `Origen #134` is honest: the
     * value is there, only its label is missing.
     */
    const options = useMemo(() => {
        const known = new Set(sources.map((source) => String(source.id)))
        const orphans = rows
            .map((row) => String(row.sourcePmsId))
            .filter((id) => id !== "0" && id !== "undefined" && !known.has(id))
        return [
            ...sources,
            ...[...new Set(orphans)].map((id) => ({ id, name: `Origen #${id}` })),
        ]
    }, [sources, rows])

    // One row per origin: the backend rejects a duplicated sourcePmsId in the
    // same request, so the UI runs out of origins before it can build one.
    const allOriginsUsed = !isLoading && sources.length > 0 && rows.length >= sources.length
    const canAddRow = !disabled && !isLoading && !catalogUnavailable && !allOriginsUsed

    const updateRow = (index: number, patch: Partial<ExternalPmsId>) => {
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    }

    const addRow = () => onChange([...rows, { sourcePmsId: 0, externalId: "" }])

    const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index))

    return (
        <div className={cn("space-y-3", className)}>
            {catalogUnavailable && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
                    No se pudo cargar el catálogo de orígenes. Los vínculos ya guardados se
                    conservan; para crear uno nuevo, vuelve a intentarlo más tarde.
                </p>
            )}

            {rows.length === 0 ? (
                isLoading ? (
                    <LoadingState
                        variant="spinner"
                        label="Cargando orígenes"
                        className="rounded-xl border border-dashed border-slate-200 py-8"
                    />
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200">
                        <EmptyState
                            className="px-6 py-8"
                            icon={<Link2 className="h-5 w-5" />}
                            title="Sin origen externo"
                            description={`Esta ${subject} se administra solo en HitGuest. Si además existe en tu PMS o en un canal, vincúlala para que sus reservas externas se asocien correctamente.`}
                            action={
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                    disabled={!canAddRow}
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Vincular origen
                                </Button>
                            }
                        />
                    </div>
                )
            ) : (
                <>
                    <div
                        aria-hidden
                        className="hidden gap-3 px-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem]"
                    >
                        <span className="text-xs font-semibold text-slate-500">Origen</span>
                        <span className="text-xs font-semibold text-slate-500">ID en el origen</span>
                        <span />
                    </div>

                    {rows.map((row, index) => {
                        // Origins already taken by the OTHER rows stay selectable nowhere else.
                        const taken = new Set(
                            rows.filter((_, i) => i !== index).map((r) => String(r.sourcePmsId)),
                        )
                        const sourceId = `${baseId}-source-${index}`
                        const externalIdId = `${baseId}-external-${index}`
                        const error = rowErrors?.[index]

                        return (
                            <div key={index} className="space-y-1">
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] sm:items-center">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor={sourceId} className="text-xs text-slate-500 sm:sr-only">
                                            Origen
                                        </Label>
                                        <Select
                                            value={row.sourcePmsId ? String(row.sourcePmsId) : undefined}
                                            onValueChange={(v) => updateRow(index, { sourcePmsId: Number(v) })}
                                            disabled={disabled || isLoading}
                                        >
                                            <SelectTrigger
                                                id={sourceId}
                                                aria-invalid={Boolean(error?.sourcePmsId)}
                                                className={cn(error?.sourcePmsId && "border-destructive")}
                                            >
                                                <SelectValue placeholder="Seleccionar origen" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {options.map((source) => (
                                                    <SelectItem
                                                        key={source.id}
                                                        value={String(source.id)}
                                                        disabled={taken.has(String(source.id))}
                                                    >
                                                        {source.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label
                                            htmlFor={externalIdId}
                                            className="text-xs text-slate-500 sm:sr-only"
                                        >
                                            ID en el origen
                                        </Label>
                                        <Input
                                            id={externalIdId}
                                            placeholder="Ej. 1476977613990701381"
                                            maxLength={EXTERNAL_ID_MAX_LENGTH}
                                            value={row.externalId ?? ""}
                                            onChange={(e) => updateRow(index, { externalId: e.target.value })}
                                            disabled={disabled}
                                            aria-invalid={Boolean(error?.externalId)}
                                            className={cn(error?.externalId && "border-destructive")}
                                        />
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Quitar origen ${index + 1}`}
                                        className="justify-self-start text-slate-400 hover:text-destructive sm:justify-self-center"
                                        onClick={() => removeRow(index)}
                                        disabled={disabled}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                {(error?.sourcePmsId || error?.externalId) && (
                                    <p className="text-xs font-medium text-destructive">
                                        {error.sourcePmsId ?? error.externalId}
                                    </p>
                                )}
                            </div>
                        )
                    })}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                            disabled={!canAddRow}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Vincular otro origen
                        </Button>
                        {allOriginsUsed && (
                            <span className="text-xs text-slate-500">
                                Ya vinculaste todos los orígenes disponibles.
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
