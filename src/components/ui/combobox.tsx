"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"
import { selectTriggerClasses } from "./select"
import { Spinner } from "./loading-state"

/**
 * Selector con buscador (DS, 2026-11-16). Reemplaza a `Select` cuando la lista
 * es larga (los ~250 países, las monedas): el huésped o el anfitrión escribe y
 * la lista se filtra sin distinguir mayúsculas ni acentos («mexico» encuentra
 * «México»).
 *
 * - El disparador es un botón con `role="combobox"` y la MISMA apariencia que
 *   `SelectTrigger` (borde input, placeholder ink-3, hover solo habilitado y
 *   sin foco ni error, deshabilitado legible). `id`, `aria-invalid` y
 *   `aria-describedby` (los pone `FormControl`) van en él: la `Label htmlFor`
 *   lo nombra.
 * - Abierto: un Popover anclado al disparador, con el buscador arriba y una
 *   lista `listbox` debajo. El foco entra al buscador; las flechas mueven la
 *   opción activa (`aria-activedescendant`), Enter elige, Escape cierra. Al
 *   cerrar, el foco vuelve al disparador.
 * - `loading`: el disparador queda deshabilitado y muestra el indicador con
 *   `loadingText` (catálogo que todavía no llegó).
 * - `name`: un `<input type="hidden">` para formularios sin react-hook-form.
 *
 * `className` no existe a propósito: la apariencia es de la primitiva; el ancho
 * es el del contenedor (`w-full`).
 */
interface ComboboxOption {
    value: string
    label: string
    disabled?: boolean
    /** Texto secundario tras la etiqueta, en ink-3 (p. ej. el código de país). */
    hint?: string
    /** Nodo delante de la etiqueta, p. ej. la bandera. */
    leading?: React.ReactNode
    /** Texto extra que también se busca (alias, código ISO). */
    keywords?: string
}

interface ComboboxProps {
    /** Lo pone `FormControl`; va en el disparador para que la `Label` lo nombre. */
    id?: string
    value: string | null
    onValueChange: (value: string | null) => void
    options: ComboboxOption[]
    /** Texto del disparador sin valor (ink-3, `data-placeholder`). */
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    /** Catálogo cargando: indicador, `loadingText` y `aria-busy`; no abre, pero sigue enfocable (no deshabilitado). */
    loading?: boolean
    loadingText?: string
    disabled?: boolean
    /** Misma altura que `SelectTrigger`: `sm` 32 px, `default` 40 px. */
    size?: "sm" | "default"
    name?: string
    "aria-invalid"?: React.AriaAttributes["aria-invalid"]
    "aria-describedby"?: string
    "aria-label"?: string
    ref?: React.Ref<HTMLButtonElement>
}

/** Sin acentos ni mayúsculas: «México», «mexico» y «MÉXICO» son lo mismo. */
function normalize(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function matches(option: ComboboxOption, query: string): boolean {
    if (!query) return true
    const haystack = normalize([option.label, option.hint, option.keywords].filter(Boolean).join(" "))
    return haystack.includes(query)
}

/** El índice de la primera opción habilitada desde `from` en la dirección dada, dando la vuelta. */
function nextEnabled(list: ComboboxOption[], from: number, direction: 1 | -1): number {
    if (list.length === 0) return -1
    let index = from
    for (let i = 0; i < list.length; i++) {
        index = (index + direction + list.length) % list.length
        if (!list[index].disabled) return index
    }
    return -1
}

function firstEnabled(list: ComboboxOption[]): number {
    return list.findIndex((option) => !option.disabled)
}

function lastEnabled(list: ComboboxOption[]): number {
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].disabled) return i
    return -1
}

function Combobox({
    id,
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder = "Buscar…",
    emptyText = "Sin resultados",
    loading = false,
    loadingText = "Cargando…",
    disabled = false,
    size = "default",
    name,
    ref,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
}: ComboboxProps) {
    const generatedId = React.useId()
    const listboxId = `${generatedId}-listbox`
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [activeIndex, setActiveIndex] = React.useState(-1)
    const triggerRef = React.useRef<HTMLButtonElement | null>(null)
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    const setTriggerRef = React.useCallback(
        (node: HTMLButtonElement | null) => {
            triggerRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
        },
        [ref]
    )

    const selected = React.useMemo(() => options.find((option) => option.value === value) ?? null, [options, value])
    const normalizedQuery = normalize(query)
    const visible = React.useMemo(() => options.filter((option) => matches(option, normalizedQuery)), [options, normalizedQuery])
    const activeOption = activeIndex >= 0 ? visible[activeIndex] : undefined
    const optionIndex = React.useMemo(() => new Map(options.map((option, index) => [option, index])), [options])
    const optionId = (option: ComboboxOption) => `${listboxId}-opt-${optionIndex.get(option) ?? -1}`
    const activeId = activeOption ? optionId(activeOption) : undefined
    const unavailable = disabled || loading

    const openList = () => {
        if (unavailable) return
        setQuery("")
        const selectedIndex = selected ? options.indexOf(selected) : -1
        setActiveIndex(selectedIndex >= 0 && !selected?.disabled ? selectedIndex : firstEnabled(options))
        setOpen(true)
    }

    const closeList = (returnFocus = true) => {
        setOpen(false)
        if (returnFocus) triggerRef.current?.focus()
    }

    const select = (option: ComboboxOption) => {
        if (option.disabled) return
        onValueChange(option.value)
        closeList()
    }

    // La opción activa se mantiene a la vista mientras se navega con el teclado.
    React.useEffect(() => {
        if (!open || !activeId) return
        document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" })
    }, [open, activeId])

    const onQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextQuery = event.target.value
        setQuery(nextQuery)
        const nextVisible = options.filter((option) => matches(option, normalize(nextQuery)))
        setActiveIndex(firstEnabled(nextVisible))
    }

    const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault()
                setActiveIndex((index) => nextEnabled(visible, index, 1))
                break
            case "ArrowUp":
                event.preventDefault()
                setActiveIndex((index) => nextEnabled(visible, index < 0 ? visible.length : index, -1))
                break
            case "Home":
                event.preventDefault()
                setActiveIndex(firstEnabled(visible))
                break
            case "End":
                event.preventDefault()
                setActiveIndex(lastEnabled(visible))
                break
            case "Enter":
                event.preventDefault()
                if (activeOption) select(activeOption)
                break
            case "Escape":
                event.preventDefault()
                closeList()
                break
            case "Tab":
                closeList()
                break
        }
    }

    const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (open) return
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault()
            openList()
        }
    }

    return (
        <Popover open={open} onOpenChange={(next) => (next ? openList() : closeList(false))}>
            <PopoverAnchor asChild>
                <button
                    ref={setTriggerRef}
                    type="button"
                    id={id}
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    // Solo con la lista montada: apuntar a un id que no existe es un error de ARIA.
                    aria-controls={open ? listboxId : undefined}
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedBy}
                    aria-label={ariaLabel}
                    aria-busy={loading || undefined}
                    // Cargando NO deshabilita: un botón deshabilitado no recibe foco, y el
                    // salto al primer campo inválido (PropertyForm) llegaba mientras el
                    // catálogo de países estaba en vuelo. Abrir sí espera (`unavailable`).
                    disabled={disabled}
                    data-slot="combobox-trigger"
                    data-size={size}
                    data-state={open ? "open" : "closed"}
                    data-placeholder={!selected && !loading ? "" : undefined}
                    onClick={() => (open ? closeList() : openList())}
                    onKeyDown={onTriggerKeyDown}
                    className={cn(
                        // La apariencia de SelectTrigger (misma fuente), a todo el ancho.
                        selectTriggerClasses,
                        "w-full"
                    )}
                >
                    <span data-slot="combobox-value" className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
                        {loading ? (
                            <>
                                <Spinner size="md" tone="muted" />
                                <span className="truncate">{loadingText}</span>
                            </>
                        ) : selected ? (
                            <>
                                {selected.leading && <span className="shrink-0">{selected.leading}</span>}
                                <span className="truncate">{selected.label}</span>
                            </>
                        ) : (
                            <span className="truncate">{placeholder}</span>
                        )}
                    </span>
                    <ChevronDownIcon className="size-4" aria-hidden />
                </button>
            </PopoverAnchor>
            {name && <input type="hidden" name={name} value={value ?? ""} />}
            <PopoverContent
                data-slot="combobox-content"
                align="start"
                className="w-(--radix-popover-trigger-width) min-w-[8rem] p-0"
                onOpenAutoFocus={(event) => {
                    event.preventDefault()
                    inputRef.current?.focus()
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault()
                }}
                onInteractOutside={(event) => {
                    // Un clic sobre el propio disparador lo maneja su onClick (cerrar), no el cierre por fuera.
                    if (triggerRef.current?.contains(event.target as Node)) event.preventDefault()
                }}
            >
                <div data-slot="combobox-search" className="border-rule flex items-center gap-2 border-b px-3">
                    <SearchIcon className="text-ink-3 size-4 shrink-0" aria-hidden />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={onQueryChange}
                        onKeyDown={onInputKeyDown}
                        placeholder={searchPlaceholder}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-autocomplete="list"
                        aria-controls={listboxId}
                        aria-activedescendant={activeId}
                        aria-label={searchPlaceholder}
                        data-slot="combobox-input"
                        className="text-ink placeholder:text-ink-3 h-10 w-full min-w-0 bg-transparent py-2 text-sm outline-none"
                    />
                </div>
                <ul
                    role="listbox"
                    id={listboxId}
                    // La lista se llama como el campo: el disparador lo nombra su Label.
                    {...(ariaLabel ? { "aria-label": ariaLabel } : id ? { "aria-labelledby": id } : {})}
                    data-slot="combobox-list"
                    className="max-h-72 overflow-y-auto p-1"
                >
                    {visible.map((option, index) => {
                        const isSelected = option.value === value
                        const isActive = index === activeIndex
                        return (
                            <li
                                key={option.value}
                                id={optionId(option)}
                                role="option"
                                aria-selected={isSelected}
                                aria-disabled={option.disabled || undefined}
                                data-slot="combobox-option"
                                data-active={isActive || undefined}
                                onMouseMove={() => {
                                    if (!option.disabled && !isActive) setActiveIndex(index)
                                }}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => select(option)}
                                className={cn(
                                    "text-ink [&_svg:not([class*='text-'])]:text-ink-3 relative flex w-full cursor-default items-center gap-2 rounded-xs py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
                                    "data-[active]:bg-accent data-[active]:text-ink",
                                    "aria-disabled:text-ink-4 aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                                )}
                            >
                                {option.leading && <span className="shrink-0">{option.leading}</span>}
                                <span className="truncate">{option.label}</span>
                                {option.hint && <span className="text-ink-3 truncate text-xs">{option.hint}</span>}
                                {isSelected && (
                                    <span data-slot="combobox-option-indicator" className="absolute right-2 flex size-3.5 items-center justify-center">
                                        <CheckIcon className="size-4" aria-hidden />
                                    </span>
                                )}
                            </li>
                        )
                    })}
                </ul>
                {visible.length === 0 && (
                    <p data-slot="combobox-empty" className="text-ink-3 px-3 py-6 text-center text-sm">
                        {emptyText}
                    </p>
                )}
            </PopoverContent>
        </Popover>
    )
}

export { Combobox }
export type { ComboboxOption, ComboboxProps }
