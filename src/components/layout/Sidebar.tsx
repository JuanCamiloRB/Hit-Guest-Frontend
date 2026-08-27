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
    type LucideIcon,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import * as React from "react"
import Image from "next/image"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Avatar as UiAvatar, AvatarFallback } from "@/components/ui/avatar"

interface NavEntry {
    label: string
    icon: LucideIcon
    href: string
    active: boolean
}

/**
 * Una entrada de navegación.
 *
 * Los dos grupos renderizaban este mismo bloque copiado carácter por carácter,
 * así que cualquier ajuste había que hacerlo dos veces (y el foco, que no
 * existía en ninguno, había que añadirlo dos veces).
 */
function NavItem({ item }: { item: NavEntry }) {
    return (
        <li>
            <Link
                href={item.href}
                // Sin esto, quien navega con lector de pantalla no tiene forma
                // de saber en qué sección está: el color no se lee.
                aria-current={item.active ? "page" : undefined}
                className={cn(
                    "group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                    item.active
                        // Se quitó `shadow-lg shadow-black/20`: una sombra negra
                        // sobre el navy del sidebar no se ve, solo ensucia el borde.
                        ? "bg-brand-purple font-semibold text-white"
                        // Antes TODO era font-bold, activo e inactivo por igual,
                        // así que el peso no distinguía nada.
                        : "font-medium text-white/70 hover:bg-white/5 hover:text-white",
                )}
            >
                <item.icon
                    aria-hidden
                    className={cn(
                        "size-5 shrink-0 transition-colors",
                        item.active ? "text-white" : "text-white/60 group-hover:text-white",
                    )}
                />
                {item.label}
            </Link>
        </li>
    )
}

/**
 * `true` solo después de hidratar. El usuario vive en un store de cliente, así
 * que el servidor no lo conoce y pintarlo en el primer render rompería la
 * hidratación.
 *
 * Antes esto era `useState(false)` + `useEffect(() => setIsMounted(true))`, que
 * es un setState dentro de un efecto — un render en cascada, y lo que marcaba
 * `react-hooks/set-state-in-effect`. `useSyncExternalStore` dice exactamente lo
 * mismo con las dos instantáneas que React ya tiene previstas: `false` en el
 * servidor, `true` en el cliente.
 */
const neverResubscribe = () => () => {}
function useHasHydrated(): boolean {
    return React.useSyncExternalStore(
        neverResubscribe,
        () => true,
        () => false,
    )
}

export function Sidebar({ className }: { className?: string }) {
    const pathname = usePathname()
    const { user, logout } = useAuth()
    const isMounted = useHasHydrated()

    const mainMenu: NavEntry[] = [
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

    const systemMenu: NavEntry[] = [
        {
            label: "Configuración",
            icon: Settings,
            href: "/dashboard/settings",
            active: pathname.startsWith("/dashboard/settings"),
        },
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
        <div className={cn("flex h-screen flex-col border-r border-white/5 bg-sidebar text-sidebar-foreground", className)}>
            <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6">
                <div className="flex justify-center px-3 pb-2">
                    <Link
                        href="/dashboard"
                        aria-label="HIT Guest — ir al tablero"
                        className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                        {/* Marca HIT (hit.tools), un poco MAYOR que el logo de
                            HIT GUEST del header interno (pedido 2026-08-27). */}
                        <Image
                            src="/logos/hit-icon-white.png"
                            alt="HIT"
                            width={468}
                            height={292}
                            priority
                            className="h-11 w-auto object-contain"
                        />
                    </Link>
                </div>

                {/* Se eliminó el rótulo "MENÚ PRINCIPAL": en un sidebar de cuatro
                    entradas, decir que el menú principal es el menú principal no
                    orienta a nadie. El nombre del grupo queda en aria-label, que
                    es donde sí hace falta. */}
                <nav aria-label="Navegación principal">
                    <ul className="space-y-1">
                        {mainMenu.map((item) => (
                            <NavItem key={item.href} item={item} />
                        ))}
                    </ul>
                </nav>

                <nav aria-label="Sistema" className="space-y-2">
                    {/* Las dos pastillas moradas eran el problema: el morado es el
                        color del ítem ACTIVO, y usarlo también en un rótulo que no
                        hace nada ponía dos moradas compitiendo, con la que no se
                        puede pulsar gritando igual de fuerte. Ahora es un simple
                        antetítulo apagado sobre una regla que separa el grupo. */}
                    <p className="border-t border-white/10 px-4 pt-4 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                        Sistema
                    </p>
                    <ul className="space-y-1">
                        {systemMenu.map((item) => (
                            <NavItem key={item.href} item={item} />
                        ))}
                    </ul>
                </nav>
            </div>

            {/* Profile Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            // `focus:outline-none` quitaba el anillo sin poner nada
                            // en su lugar: quien navega con teclado perdía el rastro
                            // del foco justo en el único control del pie.
                            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            // El nombre se corta ("Juan Camilo Ro…") porque el ancho
                            // del sidebar es fijo; al menos que se pueda leer entero
                            // al pasar el mouse.
                            title={isMounted ? displayName : undefined}
                        >
                            <UiAvatar className="size-9 shrink-0 border border-white/20">
                                <AvatarFallback className="bg-white/20 font-bold text-white">
                                    {isMounted ? initials : "H"}
                                </AvatarFallback>
                            </UiAvatar>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <p className="truncate text-sm font-semibold text-white">
                                    {isMounted ? displayName : "HIT Guest"}
                                </p>
                                {/* Antes decía "Super Admin" para todo el mundo. El rol real
                                    no viaja en UserResource (auth-service cae a "PRINCIPAL"
                                    por defecto), así que mostramos lo único verificable:
                                    el flag isAccountOwner de GET /user, y si no, el correo. */}
                                <p className="text-xs font-medium text-white/50 truncate">
                                    {!isMounted
                                        ? "Cargando…"
                                        : user?.isAccountOwner
                                          ? "Dueño de la cuenta"
                                          : (user?.email ?? "")}
                                </p>
                            </div>
                            <MoreVertical className="h-4 w-4 text-white/40" />
                        </button>
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
                                <User className="mr-2 h-4 w-4" />
                                <span>Mi cuenta</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings" className="flex w-full cursor-pointer items-center">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Configuración</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Cerrar Sesión</span>
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
                <Button variant="ghost" size="icon" className="md:hidden hover:bg-muted/20">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none p-0">
                {/* Radix exige un título en el diálogo; sin él avisa por consola
                    y el panel se abre sin nombre para un lector de pantalla. */}
                <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                <Sidebar className="h-full w-full" />
            </SheetContent>
        </Sheet>
    )
}
