"use client"

import * as React from "react"
import Link from "next/link"
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Icon } from "./icon"
import { Badge } from "./badge"
import { Overline } from "./overline"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

/**
 * La barra lateral del panel, contraíble: ancha (`w-64`) con ícono + texto, o
 * contraída (`w-16`) solo con íconos y el nombre en un `Tooltip` a la derecha
 * (y en texto `sr-only`, que es el que cuenta para el nombre accesible).
 *
 * El estado vive en `localStorage` (`hitguest:sidebar-collapsed`) para que la
 * preferencia sobreviva a la recarga, leído con `useSyncExternalStore`: en el
 * servidor y durante la hidratación es «ancha»; en el cliente, lo guardado.
 * `collapsible={false}` (el menú móvil dentro del `Sheet`) la deja siempre
 * ancha y sin disparador.
 *
 * Colores: los tokens `sidebar/*` (navy con texto blanco); el ítem activo va
 * en `primary`, igual que la selección en el resto del panel.
 */

const STORAGE_KEY = "hitguest:sidebar-collapsed"
const listeners = new Set<() => void>()

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): la sesión actual sigue sirviendo.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

// Sin almacenamiento el valor no cambia por fuera: una sola instantánea en memoria.
let memoryCollapsed = false
function readSnapshot(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === "1"
  } catch {
    // ignorado: cae a memoria
  }
  return memoryCollapsed
}

interface SidebarContextValue {
  collapsed: boolean
  collapsible: boolean
  setCollapsed: (collapsed: boolean) => void
  toggle: () => void
  /** `id` del `SidebarRoot`, para `aria-controls` del disparador. */
  panelId: string
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

/** Fuera de un `SidebarProvider` (pruebas, vistas sueltas): ancha y sin disparador. */
const DEFAULT_CONTEXT: SidebarContextValue = {
  collapsed: false,
  collapsible: false,
  setCollapsed: () => {},
  toggle: () => {},
  panelId: "sidebar",
}

function useSidebar(): SidebarContextValue {
  return React.useContext(SidebarContext) ?? DEFAULT_CONTEXT
}

function SidebarProvider({
  collapsible = true,
  children,
}: {
  collapsible?: boolean
  children: React.ReactNode
}) {
  const stored = React.useSyncExternalStore(subscribe, readSnapshot, () => false)
  const panelId = React.useId()
  const collapsed = collapsible && stored
  const setCollapsed = React.useCallback((value: boolean) => {
    memoryCollapsed = value
    writeCollapsed(value)
  }, [])
  const value = React.useMemo<SidebarContextValue>(
    () => ({ collapsed, collapsible, setCollapsed, toggle: () => setCollapsed(!collapsed), panelId }),
    [collapsed, collapsible, setCollapsed, panelId],
  )
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

/** El `<aside>` que ocupa la columna; su ancho sigue al estado con transición. */
function SidebarRoot({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { collapsed, panelId } = useSidebar()
  return (
    <aside
      id={panelId}
      data-slot="sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-16" : "w-64",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

/** Contraer / expandir. Solo existe cuando la barra es contraíble. */
function SidebarTrigger({ className, ...props }: Omit<React.ComponentProps<typeof Button>, "children">) {
  const { collapsed, collapsible, toggle, panelId } = useSidebar()
  if (!collapsible) return null
  const label = collapsed ? "Expandir menú" : "Contraer menú"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-slot="sidebar-trigger"
          aria-label={label}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={toggle}
          className={cn("text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-sidebar-ring", className)}
          {...props}
        >
          <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** El rótulo de un grupo: `Overline` ancha; contraída, solo la regla que separa. */
function SidebarGroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  const { collapsed } = useSidebar()
  if (collapsed) {
    return <div role="presentation" className={cn("mx-3 border-t border-sidebar-border", className)} />
  }
  return (
    <Overline className={cn("border-t border-sidebar-border px-4 pt-4 text-sidebar-foreground/70", className)}>
      {children}
    </Overline>
  )
}

interface SidebarItemProps {
  href: string
  icon: LucideIcon
  label: string
  active?: boolean
  /** Marca corta junto a la etiqueta (p. ej. «HIT» en las pantallas de soporte). Contraída, no se ve. */
  badge?: string
}

/**
 * Una entrada de navegación. Ancha: ícono + etiqueta (+ marca). Contraída:
 * solo el ícono centrado, la etiqueta en `sr-only` y en el `Tooltip`.
 */
function SidebarItem({ href, icon, label, active = false, badge }: SidebarItemProps) {
  const { collapsed } = useSidebar()
  const link = (
    <Link
      href={href}
      data-slot="sidebar-item"
      data-active={active || undefined}
      // Sin esto, quien navega con lector de pantalla no sabe en qué sección está: el color no se lee.
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
        collapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5",
        active
          ? "bg-primary font-semibold text-white"
          : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon
        icon={icon}
        size="lg"
        className={cn("transition-colors", active ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")}
      />
      <span className={cn("flex-1", collapsed && "sr-only")}>{label}</span>
      {badge && !collapsed && <Badge tone="surface">{badge}</Badge>}
    </Link>
  )
  if (!collapsed) return <li>{link}</li>
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{badge ? `${label} · ${badge}` : label}</TooltipContent>
      </Tooltip>
    </li>
  )
}

export { SidebarProvider, SidebarRoot, SidebarTrigger, SidebarGroupLabel, SidebarItem, useSidebar, STORAGE_KEY as SIDEBAR_STORAGE_KEY }
export type { SidebarItemProps }
