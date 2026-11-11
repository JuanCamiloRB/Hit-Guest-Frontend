"use client"

import { useState } from "react"
import { Plus, Trash2, Eye, EyeOff } from "lucide-react"
import { Icon } from "@/components/ui/icon"
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
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Textarea } from "@/components/ui/textarea"

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
                <Label className="text-sm font-semibold text-ink-2">{schema.label}</Label>
                {items.map((item, i) => (
                    <div key={i} className="border border-rule rounded-xl p-3 space-y-2 bg-sunk/50">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-ink-3">
                                Elemento {i + 1}
                            </span>
                            <UnstyledButton
                                type="button"
                                onClick={() => removeItem(i)}
                                className="text-danger hover:text-danger transition-colors"
                            >
                                <Icon icon={Trash2} size="sm" />
                            </UnstyledButton>
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
                        <UnstyledButton
                            type="button"
                            onClick={() => removeItem(i)}
                            className="text-danger hover:text-danger transition-colors shrink-0"
                        >
                            <Icon icon={Trash2} />
                        </UnstyledButton>
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
            <div className="relative">
                <Input
                    type={isPassword && !showPwd ? "password" : "text"}
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                    className="pr-10"
                />
                {isPassword && (
                    <UnstyledButton
                        type="button"
                        onClick={() => setShowPwd(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
                    >
                        {showPwd ? <Icon icon={EyeOff} /> : <Icon icon={Eye} />}
                    </UnstyledButton>
                )}
            </div>
        </div>
    )
}
