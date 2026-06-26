"use client"

import { useState } from "react"
import { Plus, Trash2, Eye, EyeOff } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ParameterFieldSchema } from "../../types/automation"

interface Props {
    schema: ParameterFieldSchema
    value: any
    onChange: (v: any) => void
}

export function ParameterField({ schema, value, onChange }: Props) {
    const [showPwd, setShowPwd] = useState(false)

    if (schema.type === "array") {
        const items: any[] = Array.isArray(value) ? value : []

        const addItem = () => {
            const blank: Record<string, any> = {}
            schema.arrayItemSchema?.forEach(s => { blank[s.key] = "" })
            onChange([...items, blank])
        }
        const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i))
        const updateItem = (i: number, key: string, v: any) => {
            onChange(items.map((item, idx) => idx === i ? { ...item, [key]: v } : item))
        }

        return (
            <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700">{schema.label}</Label>
                {items.map((item, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Elemento {i + 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeItem(i)}
                                className="text-red-400 hover:text-red-600 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        {schema.arrayItemSchema?.map(sub => (
                            <ParameterField
                                key={sub.key}
                                schema={sub}
                                value={item[sub.key] ?? ""}
                                onChange={v => updateItem(i, sub.key, v)}
                            />
                        ))}
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="w-full gap-1.5 border-dashed"
                >
                    <Plus size={14} /> Agregar {schema.label}
                </Button>
            </div>
        )
    }

    if (schema.type === "string_array") {
        // Flat list of scalar strings, e.g. recipients: ["a@x.com", "b@y.com"].
        // Tolerant of the legacy object shape [{email}] so old data still renders.
        const items: string[] = (Array.isArray(value) ? value : []).map((it: any) =>
            typeof it === "string" ? it : (it?.email ?? it?.value ?? "")
        )
        const addItem = () => onChange([...items, ""])
        const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i))
        const updateItem = (i: number, v: string) => onChange(items.map((it, idx) => (idx === i ? v : it)))

        return (
            <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">
                    {schema.label}
                    {schema.required && <span className="text-red-400 ml-0.5">*</span>}
                </Label>
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            type={schema.itemType === "email" ? "email" : "text"}
                            value={item}
                            onChange={e => updateItem(i, e.target.value)}
                            placeholder={schema.placeholder}
                            className="bg-slate-50 border-slate-200"
                        />
                        <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="w-full gap-1.5 border-dashed"
                >
                    <Plus size={14} /> Agregar {schema.label.toLowerCase()}
                </Button>
            </div>
        )
    }

    if (schema.type === "textarea") {
        return (
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">
                    {schema.label}
                    {schema.required && <span className="text-red-400 ml-0.5">*</span>}
                </Label>
                <textarea
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                    rows={4}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple)]/20 focus:border-[var(--color-brand-purple)]/40 resize-y"
                />
            </div>
        )
    }

    if (schema.type === "select") {
        return (
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">
                    {schema.label}
                    {schema.required && <span className="text-red-400 ml-0.5">*</span>}
                </Label>
                <Select value={value ?? ""} onValueChange={onChange}>
                    <SelectTrigger className="bg-slate-50 border-slate-200">
                        <SelectValue placeholder={schema.placeholder ?? `Selecciona ${schema.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {schema.options?.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )
    }

    const isPassword = schema.type === "password"
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">
                {schema.label}
                {schema.required && <span className="text-red-400 ml-0.5">*</span>}
            </Label>
            <div className="relative">
                <Input
                    type={isPassword && !showPwd ? "password" : "text"}
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                    className="bg-slate-50 border-slate-200 pr-10"
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPwd(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </div>
    )
}
