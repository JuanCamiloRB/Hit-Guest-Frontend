"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search, Check } from "lucide-react"

interface Option {
  id: number
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  label: string
  options: Option[]
  value: number | ""
  onChange: (value: number) => void
  placeholder?: string
  required?: boolean
  id?: string
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  required = false,
  id,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options

  // Se compara por string a propósito.
  //
  // Los catálogos del backend entregan `id` como string (`String(item.uuid ||
  // item.id)`), pero el tipo de las opciones —y lo que el formulario guarda—
  // es número, y cada pantalla normalizaba distinto: `IdentifyScreen` hacía
  // `Number(c.id)` y los formularios no. Con `===` estricto, un borrador
  // guardado con una forma y unas opciones cargadas con la otra no casaban, y
  // el select mostraba el placeholder como si el huésped no hubiera elegido
  // nada — perdiendo visualmente un dato que sí estaba guardado.
  const selectedOption =
    value === "" || value == null
      ? null
      : options.find((o) => String(o.id) === String(value)) ?? null

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          id={id}
          onClick={() => {
            setIsOpen(!isOpen)
            setSearch("")
          }}
          className={`
            w-full bg-slate-50 border rounded-xl px-4 py-3 text-left
            flex items-center justify-between gap-2
            transition-all
            ${isOpen
              ? "border-brand-purple ring-2 ring-brand-purple/30"
              : "border-slate-200 hover:border-slate-300"
            }
          `}
        >
          <span className={`min-w-0 truncate ${selectedOption ? "text-slate-900" : "text-slate-400"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Input */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-purple/30 focus:border-brand-purple transition-all"
                  placeholder="Buscar..."
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-3 text-sm text-slate-400 text-center">
                  Sin resultados
                </div>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setIsOpen(false)
                      setSearch("")
                    }}
                    className={`
                      w-full text-left px-4 py-2.5 text-sm flex items-center justify-between
                      transition-colors hover:bg-brand-purple/5
                      ${value === option.id ? "bg-brand-purple/5 text-brand-purple font-medium" : "text-slate-700"}
                    `}
                  >
                    <div>
                      <span>{option.label}</span>
                      {option.sublabel && (
                        <span className="text-xs text-slate-400 ml-2">{option.sublabel}</span>
                      )}
                    </div>
                    {value === option.id && <Check size={16} className="text-brand-purple" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
