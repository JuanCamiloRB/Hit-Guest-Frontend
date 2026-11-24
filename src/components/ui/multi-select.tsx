"use client"

import * as React from "react"
import { ChevronDown, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { Icon } from "./icon"
import { Label } from "./label"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { UnstyledButton } from "./unstyled-button"

/**
 * Filtro de selección múltiple: un disparador con forma de campo (`Button
 * field`) y, abierto, la opción «todas» arriba y una casilla por opción.
 * Selección vacía = todas. El disparador dice qué hay elegido: «Todas las
 * propiedades», el nombre de la única elegida o «3 seleccionadas».
 *
 * `label` es el nombre del filtro para lectores de pantalla («Filtrar por
 * propiedad»): el texto del disparador cambia con la selección y no basta.
 * `className` solo layout del disparador (ancho mínimo).
 */
interface MultiSelectOption {
    id: string
    name: string
}

interface MultiSelectProps {
    label: string
    /** El texto de «todas» («Todas las propiedades»). */
    allLabel: string
    options: readonly MultiSelectOption[]
    selected: ReadonlySet<string>
    onToggle: (id: string) => void
    onClear: () => void
    icon?: LucideIcon
    /** El plural de lo elegido para el disparador («seleccionadas», «seleccionados»). */
    selectedWord?: string
    className?: string
}

function MultiSelect({ label, allLabel, options, selected, onToggle, onClear, icon, selectedWord = "seleccionados", className }: MultiSelectProps) {
    const chosen = options.filter((o) => selected.has(o.id))
    const triggerText = chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].name : `${chosen.length} ${selectedWord}`
    const listId = React.useId()
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button type="button" variant="field" aria-label={`${label}: ${triggerText}`} data-slot="multi-select" className={cn("min-w-48", className)}>
                    <span className="flex min-w-0 items-center gap-2">
                        {icon && <Icon icon={icon} className="text-ink-3" />}
                        <span className="truncate">{triggerText}</span>
                    </span>
                    <Icon icon={ChevronDown} className="text-ink-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1">
                <UnstyledButton
                    type="button"
                    onClick={onClear}
                    aria-pressed={chosen.length === 0}
                    className={cn(
                        "w-full rounded-xs px-2 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-primary/5",
                        chosen.length === 0 ? "text-primary" : "text-ink-2",
                    )}
                >
                    {allLabel}
                </UnstyledButton>
                <div role="group" aria-label={label} id={listId} className="mt-0.5 max-h-64 overflow-y-auto border-t border-rule pt-1">
                    {options.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-ink-3">Sin opciones</p>
                    ) : (
                        options.map((o) => {
                            const id = `${listId}-${o.id}`
                            return (
                                <div key={o.id} className="flex items-center gap-2 rounded-xs px-2 py-1.5 transition-colors hover:bg-primary/5">
                                    <Checkbox id={id} checked={selected.has(o.id)} onCheckedChange={() => onToggle(o.id)} />
                                    <Label variant="plain" htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate text-sm text-ink-2">{o.name}</Label>
                                </div>
                            )
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export { MultiSelect, type MultiSelectOption, type MultiSelectProps }
