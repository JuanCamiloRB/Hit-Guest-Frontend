"use client"

import * as React from "react"
import Link from "next/link"
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { SIDEBAR_COOKIE_COLLAPSED, SIDEBAR_COOKIE_EXPANDED, SIDEBAR_COOKIE_NAME, SIDEBAR_STORAGE_KEY } from "@/lib/sidebar-preference"
import { useHasHydrated } from "@/hooks/useHasHydrated"
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

// La misma preferencia en localStorage y en una cookie: el layout (servidor)
// lee la cookie y pinta la barra ya contraída desde el primer HTML, sin saltar
// de 256 a 64 px al hidratar. Los nombres viven en `lib/sidebar-preference`
// (sin "use client") para que el servidor reciba el valor y no una referencia.
const STORAGE_KEY = SIDEBAR_STORAGE_KEY
const COOKIE_NAME = SIDEBAR_COOKIE_NAME
const listeners = new Set<() => void>()

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): la sesión actual sigue sirviendo.
  }
  try {
    document.cookie = `${COOKIE_NAME}=${value ? SIDEBAR_COOKIE_COLLAPSED : SIDEBAR_COOKIE_EXPANDED}; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // Sin cookies: la próxima carga arranca ancha y se ajusta al hidratar.
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

// Solo SIN almacenamiento (ventana privada, bloqueado) el valor vive en memoria.
let memoryCollapsed: boolean | null = null
function readSnapshot(fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === null ? fallback : stored === "1"
  } catch {
    return memoryCollapsed ?? fallback
  }
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
  defaultCollapsed = false,
  children,
}: {
  collapsible?: boolean
  /** Lo que dice la cookie `hitguest_sidebar` (la lee el layout en el servidor). */
  defaultCollapsed?: boolean
  children: React.ReactNode
}) {
  const stored = React.useSyncExternalStore(subscribe, () => readSnapshot(defaultCollapsed), () => defaultCollapsed)
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

/**
 * El `<aside>` que ocupa la columna; su ancho sigue al estado. La transición
 * se activa después de hidratar: así, si la preferencia guardada y la cookie
 * no coinciden, el ajuste inicial es instantáneo y no un salto animado.
 * `id` y `data-state` son de la primitiva: van después de `...props`.
 */
function SidebarRoot({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { collapsed, panelId } = useSidebar()
  const hydrated = useHasHydrated()
  return (
    <aside
      {...props}
      id={panelId}
      data-slot="sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        hydrated && "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {children}
    </aside>
  )
}

/**
 * Contraer / expandir. Solo existe cuando la barra es contraíble. Con forma
 * propia (caja `sidebar-accent` con borde) para que se vea como un control y
 * no como un ícono suelto sobre el navy.
 */
function SidebarTrigger({ className, onClick, ...props }: Omit<React.ComponentProps<typeof Button>, "children">) {
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
          {...props}
          // Lo que define al control va DESPUÉS de `...props`: un consumidor no
          // puede pisar el nombre, el estado ni el `aria-controls`. Su `onClick`
          // se compone; solo con `preventDefault` evita el cambio.
          data-slot="sidebar-trigger"
          aria-label={label}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={(event) => {
            onClick?.(event)
            if (!event.defaultPrevented) toggle()
          }}
          className={cn(
            "border border-sidebar-control-border bg-sidebar-control text-sidebar-foreground shadow-xs",
            "hover:border-sidebar-foreground/50 hover:bg-sidebar-foreground/25 hover:text-sidebar-foreground focus-visible:outline-sidebar-ring",
            className,
          )}
        >
          <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size="md" />
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

export { SidebarProvider, SidebarRoot, SidebarTrigger, SidebarGroupLabel, SidebarItem, useSidebar }
export { SIDEBAR_STORAGE_KEY, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-preference"
export type { SidebarItemProps }
