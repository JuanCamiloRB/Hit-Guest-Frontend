"use client"

import { Plus, Trash2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Surface } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ParameterFieldSchema } from "../../types/automation"
import { Textarea } from "@/components/ui/textarea"

interface Props {
    schema: ParameterFieldSchema
    value: any
    onChange: (v: any) => void
}

export function ParameterField({ schema, value, onChange }: Props) {

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
                <Label className="text-sm font-semibold text-ink-2">{schema.label}</Label>
                {items.map((item, i) => (
                    <Surface key={i} tone="sunk" className="space-y-2 p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-ink-3">
                                Elemento {i + 1}
                            </span>
                            <Button type="button" variant="ghost-destructive" size="icon-sm" onClick={() => removeItem(i)} aria-label="Quitar">
                                <Icon icon={Trash2} />
                            </Button>
                        </div>
                        {schema.arrayItemSchema?.map(sub => (
                            <ParameterField
                                key={sub.key}
                                schema={sub}
                                value={item[sub.key] ?? ""}
                                onChange={v => updateItem(i, sub.key, v)}
                            />
                        ))}
                    </Surface>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="w-full"
                >
                    <Icon icon={Plus} /> Agregar {schema.label}
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
                <Label className="text-sm font-semibold text-ink-2">
                    {schema.label}
                    {schema.required && <span className="text-danger ml-0.5">*</span>}
                </Label>
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            type={schema.itemType === "email" ? "email" : "text"}
                            value={item}
                            onChange={e => updateItem(i, e.target.value)}
                            placeholder={schema.placeholder}
                        />
                        <Button type="button" variant="ghost-destructive" size="icon-sm" onClick={() => removeItem(i)} aria-label="Quitar" className="shrink-0">
                            <Icon icon={Trash2} />
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="w-full"
                >
                    <Icon icon={Plus} /> Agregar {schema.label.toLowerCase()}
                </Button>
            </div>
        )
    }

    if (schema.type === "textarea") {
        return (
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-ink-2">
                    {schema.label}
                    {schema.required && <span className="text-danger ml-0.5">*</span>}
                </Label>
                <Textarea
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                    rows={4}
                    className="w-full px-3 py-2 text-sm placeholder:text-ink-3 resize-y"
                />
            </div>
        )
    }

    if (schema.type === "select") {
        return (
            <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-ink-2">
                    {schema.label}
                    {schema.required && <span className="text-danger ml-0.5">*</span>}
                </Label>
                <Select value={value ?? ""} onValueChange={onChange}>
                    <SelectTrigger>
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
            <Label className="text-sm font-semibold text-ink-2">
                {schema.label}
                {schema.required && <span className="text-danger ml-0.5">*</span>}
            </Label>
            {isPassword ? (
                <PasswordInput
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                />
            ) : (
                <Input
                    type="text"
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                />
            )}
        </div>
    )
}
