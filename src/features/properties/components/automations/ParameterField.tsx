"use client"

import { useId } from "react"
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
import { FieldError, FieldHint } from "@/components/ui/form"

interface Props {
    schema: ParameterFieldSchema
    value: any
    onChange: (v: any) => void
    error?: string | null
    hint?: string
}

export function ParameterField({ schema, value, onChange, error, hint }: Props) {
    const generatedId = useId()
    const inputId = `${generatedId}-input`
    const hintId = `${generatedId}-hint`
    const errorId = `${generatedId}-error`
    const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined

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
                            <Button type="button" variant="ghost-destructive" size="icon-sm" onClick={() => removeItem(i)} aria-label={`Quitar elemento ${i + 1}`}>
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
                {hint && <FieldHint id={hintId} compact>{hint}</FieldHint>}
                <FieldError id={errorId} compact>{error}</FieldError>
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
                            aria-label={`${schema.label} ${i + 1}`}
                            aria-required={schema.required && i === 0 ? true : undefined}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={describedBy}
                            type={schema.itemType === "email" ? "email" : "text"}
                            value={item}
                            onChange={e => updateItem(i, e.target.value)}
                            placeholder={schema.placeholder}
                        />
                        <Button type="button" variant="ghost-destructive" size="icon-sm" onClick={() => removeItem(i)} aria-label={`Quitar ${schema.label} ${i + 1}`} className="shrink-0">
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
                {hint && <FieldHint id={hintId} compact>{hint}</FieldHint>}
                <FieldError id={errorId} compact>{error}</FieldError>
            </div>
        )
    }

    if (schema.type === "textarea") {
        return (
            <div className="space-y-1.5">
                <Label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
                    {schema.label}
                    {schema.required && <span className="text-danger ml-0.5">*</span>}
                </Label>
                <Textarea
                    id={inputId}
                    aria-required={schema.required || undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                    rows={4}
                    className="w-full px-3 py-2 text-sm placeholder:text-ink-3 resize-y"
                />
                {hint && <FieldHint id={hintId} compact>{hint}</FieldHint>}
                <FieldError id={errorId} compact>{error}</FieldError>
            </div>
        )
    }

    if (schema.type === "select") {
        return (
            <div className="space-y-1.5">
                <Label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
                    {schema.label}
                    {schema.required && <span className="text-danger ml-0.5">*</span>}
                </Label>
                <Select value={value ?? ""} onValueChange={onChange}>
                    <SelectTrigger id={inputId} aria-required={schema.required || undefined} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
                        <SelectValue placeholder={schema.placeholder ?? `Selecciona ${schema.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {schema.options?.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {hint && <FieldHint id={hintId} compact>{hint}</FieldHint>}
                <FieldError id={errorId} compact>{error}</FieldError>
            </div>
        )
    }

    const isPassword = schema.type === "password"
    return (
        <div className="space-y-1.5">
            <Label htmlFor={inputId} className="text-sm font-semibold text-ink-2">
                {schema.label}
                {schema.required && <span className="text-danger ml-0.5">*</span>}
            </Label>
            {isPassword ? (
                <PasswordInput
                    id={inputId}
                    aria-required={schema.required || undefined}
                    // Un gestor de contraseñas ve «texto + contraseña» (SIRE: número de documento
                    // y clave) como un login y rellenaba la clave del PM en HIT: eso marcaba el
                    // campo como cambiado y la enviaba como credencial del Ministerio.
                    autoComplete="new-password"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                />
            ) : (
                <Input
                    id={inputId}
                    aria-required={schema.required || undefined}
                    autoComplete="off"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    type="text"
                    value={value ?? ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={schema.placeholder}
                />
            )}
            {hint && <FieldHint id={hintId} compact>{hint}</FieldHint>}
            <FieldError id={errorId} compact>{error}</FieldError>
        </div>
    )
}
