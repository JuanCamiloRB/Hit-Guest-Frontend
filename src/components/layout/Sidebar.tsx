"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
    LayoutGrid,
    CalendarDays,
    Settings,
    User,
    Menu,
    Home,
    MoreVertical,
    LogOut,
    Headset,
    UserCog,
    type LucideIcon,
} from "lucide-react"
import { SidebarGroupLabel, SidebarItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Icon } from "@/components/ui/icon"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import Image from "next/image"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"
import { useIsSupportAgentOnly } from "@/features/support/hooks/useIsSupportAgentOnly"
import { Avatar as UiAvatar, AvatarFallback } from "@/components/ui/avatar"
import { UnstyledButton } from "@/components/ui/unstyled-button"

interface NavEntry {
    label: string
    icon: LucideIcon
    href: string
    active: boolean
    /** Marca corta junto a la etiqueta (p. ej. «HIT» en las pantallas de soporte). */
    badge?: string
}

/** Una entrada de navegación: la pinta la primitiva (`SidebarItem`), ancha o contraída. */
function NavItem({ item }: { item: NavEntry }) {
    return <SidebarItem href={item.href} icon={item.icon} label={item.label} active={item.active} badge={item.badge} />
}

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname()
    const { user, logout, isInSupportSession } = useAuth()
    const isMounted = useHasHydrated()
    const { collapsed } = useSidebar()
    // Solo con el flag explícito (contrato §5b) y FUERA del modo soporte: el
    // token de soporte es el del usuario del cliente.
    const outsideSupport = isMounted && !isInSupportSession
    const canSeeConsole = outsideSupport && user?.canAccessSupportConsole === true
    const canSeeAgents = outsideSupport && user?.canManageSupportAgents === true
    // Un agente puro no es PM: el panel normal le muestra la cuenta interna de
    // HIT y toda acción le da 403. Fuera del modo soporte solo ve la consola.
    const showAccountMenu = !useIsSupportAgentOnly()

    const accountMenu: NavEntry[] = [
        {
            label: "Tablero",
            icon: LayoutGrid,
            href: "/dashboard",
            active: pathname === "/dashboard",
        },
        {
            label: "Operaciones",
            icon: CalendarDays,
            href: "/dashboard/reservations",
            active: pathname.startsWith("/dashboard/reservations"),
        },
        {
            label: "Propiedades",
            icon: Home,
            href: "/dashboard/properties",
            active: pathname.startsWith("/dashboard/properties"),
        },
    ]

    const mainMenu: NavEntry[] = showAccountMenu ? accountMenu : []

    const systemMenu: NavEntry[] = [
        ...(canSeeConsole
            ? [{
                label: "Consola de soporte",
                icon: Headset,
                href: "/dashboard/support",
                active: pathname === "/dashboard/support",
                badge: "HIT",
            }]
            : []),
        ...(canSeeAgents
            ? [{
                label: "Agentes de soporte",
                icon: UserCog,
                href: "/dashboard/support/agents",
                active: pathname.startsWith("/dashboard/support/agents"),
                badge: "HIT",
            }]
            : []),
        ...(showAccountMenu
            ? [{
                label: "Configuración",
                icon: Settings,
                href: "/dashboard/settings",
                active: pathname.startsWith("/dashboard/settings"),
            }]
            : []),
    ]

    // `firstName` trae el nombre completo (el User de la API no tiene lastName).
    const displayName = user?.firstName?.trim() || "HIT Guest"
    // El `.split(' ')` anterior no filtraba: un nombre con doble espacio daba
    // ["Juan", "", "Camilo"], y `""[0]` es undefined → salía "JundefinedC".
    const initials =
        displayName
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "U"

    return (
        <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
            <div className={cn("no-scrollbar flex-1 space-y-6 overflow-y-auto py-6", collapsed ? "px-2" : "px-4")}>
                {/* Logo y, a su derecha, el disparador para contraer; contraída, el logo
                    chico arriba y el disparador debajo (no cabe al lado). */}
                <div className={cn("flex items-center gap-2 pb-2", collapsed ? "flex-col px-0" : "justify-between px-3")}>
                    <Link
                        href="/dashboard"
                        aria-label="HIT Guest — ir al tablero"
                        className="rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
                    >
                        {/* Marca HIT (hit.tools), un poco MAYOR que el logo de
                            HIT GUEST del header interno (pedido 2026-08-27). */}
                        <Image
                            src="/logos/hit-icon-white.png"
                            alt="HIT"
                            width={468}
                            height={292}
                            priority
                            className={cn("w-auto object-contain", collapsed ? "h-8" : "h-11")}
                        />
                    </Link>
                    <SidebarTrigger />
                </div>

                {/* Se eliminó el rótulo "MENÚ PRINCIPAL": en un sidebar de cuatro
                    entradas, decir que el menú principal es el menú principal no
                    orienta a nadie. El nombre del grupo queda en aria-label, que
                    es donde sí hace falta. */}
                {mainMenu.length > 0 && (
                    <nav aria-label="Navegación principal">
                        <ul className="space-y-1">
                            {mainMenu.map((item) => (
                                <NavItem key={item.href} item={item} />
                            ))}
                        </ul>
                    </nav>
                )}

                <nav aria-label="Sistema" className="space-y-2">
                    {/* Un antetítulo apagado sobre una regla, nunca una pastilla morada
                        (el morado es el ítem ACTIVO). Contraída, queda solo la regla. */}
                    <SidebarGroupLabel>Sistema</SidebarGroupLabel>
                    <ul className="space-y-1">
                        {systemMenu.map((item) => (
                            <NavItem key={item.href} item={item} />
                        ))}
                    </ul>
                </nav>
            </div>

            {/* Profile Footer */}
            <div className={cn("border-t border-sidebar-border bg-sidebar-accent", collapsed ? "p-2" : "p-4")}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <UnstyledButton
                            // `focus:outline-none` quitaba el anillo sin poner nada
                            // en su lugar: quien navega con teclado perdía el rastro
                            // del foco justo en el único control del pie.
                            className={cn(
                                "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                                collapsed && "justify-center",
                            )}
                            // El nombre se corta ("Juan Camilo Ro…") porque el ancho
                            // del sidebar es fijo; al menos que se pueda leer entero
                            // al pasar el mouse.
                            title={isMounted ? displayName : undefined}
                        >
                            <UiAvatar size="lg" tone="inverse">
                                <AvatarFallback>
                                    {isMounted ? initials : "H"}
                                </AvatarFallback>
                            </UiAvatar>
                            {/* Contraída: solo el avatar; el nombre sigue en `title` y para el lector. */}
                            {collapsed && <span className="sr-only">{isMounted ? displayName : "HIT Guest"}</span>}
                            <div className={cn("flex min-w-0 flex-1 flex-col", collapsed && "hidden")}>
                                <p className="truncate text-sm font-semibold text-white">
                                    {isMounted ? displayName : "HIT Guest"}
                                </p>
                                {/* Antes decía "Super Admin" para todo el mundo. El rol real
                                    no viaja en UserResource (auth-service cae a "PRINCIPAL"
                                    por defecto), así que mostramos lo único verificable:
                                    el flag isAccountOwner de GET /user, y si no, el correo. */}
                                <p className="text-xs font-medium text-white/70 truncate">
                                    {!isMounted
                                        ? "Cargando…"
                                        : user?.isAccountOwner
                                          ? "Dueño de la cuenta"
                                          : (user?.email ?? "")}
                                </p>
                            </div>
                            {!collapsed && <Icon icon={MoreVertical} className="text-sidebar-foreground/30" />}
                        </UnstyledButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" side="top">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {/* Los dos apuntaban a `/dashboard/settings` a secas: dos
                            entradas distintas que llevaban exactamente al mismo
                            sitio. SettingsContent ya lee `?tab=`, así que "Mi
                            cuenta" abre su pestaña y deja de duplicar a
                            "Configuración". El icono era `Users` (varias personas)
                            para el perfil de una sola. */}
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings?tab=profile" className="flex w-full cursor-pointer items-center">
                                <Icon icon={User} className="mr-2" />
                                <span>Mi cuenta</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings" className="flex w-full cursor-pointer items-center">
                                <Icon icon={Settings} className="mr-2" />
                                <span>Configuración</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-danger focus:text-danger cursor-pointer" onClick={logout}>
                            <Icon icon={LogOut} className="mr-2" />
                            <span>{isInSupportSession ? "Salir del modo soporte" : "Cerrar Sesión"}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

export function MobileSidebar() {
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                    <Icon icon={Menu} />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none p-0">
                {/* Radix exige un título en el diálogo; sin él avisa por consola
                    y el panel se abre sin nombre para un lector de pantalla. */}
                <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                {/* En el panel móvil no se contrae: su propio proveedor, siempre ancho. */}
                <TooltipProvider>
                    <SidebarProvider collapsible={false}>
                        <Sidebar className="h-full w-full" />
                    </SidebarProvider>
                </TooltipProvider>
            </SheetContent>
        </Sheet>
    )
}
