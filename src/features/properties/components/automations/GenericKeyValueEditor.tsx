"use client"

import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export interface KeyValueRow {
    key: string
    value: string
}

interface Props {
    rows: KeyValueRow[]
    onChange: (rows: KeyValueRow[]) => void
    /** Keys already handled by provider-specific fields (shown as a hint if collided). */
    reservedKeys?: string[]
}

/**
 * Generic key-value editor for override parameters that aren't covered by
 * provider-specific fields. Lets the PM add arbitrary `{ key: value }` pairs so
 * future/undocumented parameters can still be configured from the UI.
 */
export function GenericKeyValueEditor({ rows, onChange, reservedKeys = [] }: Props) {
    const addRow = () => onChange([...rows, { key: "", value: "" }])
    const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
    const updateRow = (i: number, patch: Partial<KeyValueRow>) =>
        onChange(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

    return (
        <div className="space-y-2">
            {rows.map((row, i) => {
                const collides = !!row.key && reservedKeys.includes(row.key.trim())
                return (
                    <div key={i} className="flex items-start gap-2">
                        <div className="flex-1 grid gap-1">
                            <Input
                                placeholder="clave"
                                value={row.key}
                                onChange={e => updateRow(i, { key: e.target.value })}
                                className="h-8 text-sm bg-slate-50 border-slate-200"
                            />
                            {collides && (
                                <span className="text-[10px] text-amber-600">
                                    Esta clave ya tiene un campo específico arriba; ese valor tendrá prioridad.
                                </span>
                            )}
                        </div>
                        <Input
                            placeholder="valor"
                            value={row.value}
                            onChange={e => updateRow(i, { value: e.target.value })}
                            className="h-8 text-sm bg-slate-50 border-slate-200 flex-1"
                        />
                        <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="text-red-400 hover:text-red-600 transition-colors mt-1.5 shrink-0"
                            aria-label="Eliminar parámetro"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )
            })}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="w-full gap-1.5 border-dashed"
            >
                <Plus size={14} /> Agregar parámetro personalizado
            </Button>
            {rows.length === 0 && (
                <Label className="text-[11px] text-slate-400">
                    Sin parámetros personalizados.
                </Label>
            )}
        </div>
    )
}
