"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
    LayoutGrid,
    CalendarDays,
    Settings,
    Users,
    Menu,
    Home,
    MoreVertical,
    LogOut,
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

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname()
    const { user, logout } = useAuth()
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    const mainMenu = [
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

    const systemMenu = [
        {
            label: "Configuración",
            icon: Settings,
            href: "/dashboard/settings",
            active: pathname.startsWith("/dashboard/settings"),
        },
    ]

    return (
        <div className={cn("flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-white/5", className)}>
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 no-scrollbar">
                {/* Logo Section - Restored to Sidebar */}
                <div className="px-3 mb-2 flex justify-center">
                    <Link href="/dashboard">
                        <Image
                            src="/logos/hit-icon-white.png"
                            alt="HIT Guest"
                            width={468}
                            height={292}
                            className="h-9 w-auto object-contain"
                        />
                    </Link>
                </div>

                <section className="space-y-4">
                    <h3 className="px-3">
                        <span className="inline-block rounded-md bg-[var(--color-brand-purple)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                            Menú Principal
                        </span>
                    </h3>
                    <div className="space-y-1">
                        {mainMenu.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200",
                                    item.active
                                        ? "bg-[var(--color-brand-purple)] text-white shadow-lg shadow-black/20"
                                        : "text-white/70 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn(
                                    "mr-3 h-5 w-5 transition-colors",
                                    item.active ? "text-white" : "text-white/60 group-hover:text-white"
                                )} />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="px-3">
                        <span className="inline-block rounded-md bg-[var(--color-brand-purple)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                            Sistema
                        </span>
                    </h3>
                    <div className="space-y-1">
                        {systemMenu.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200",
                                    item.active
                                        ? "bg-[var(--color-brand-purple)] text-white shadow-lg shadow-black/20"
                                        : "text-white/70 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn(
                                    "mr-3 h-5 w-5 transition-colors",
                                    item.active ? "text-white" : "text-white/60 group-hover:text-white"
                                )} />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </section>
            </div>

            {/* Profile Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full hover:bg-white/5 p-2 rounded-lg transition-colors text-left focus:outline-none">
                            <UiAvatar className="h-10 w-10 border border-white/20">
                                <AvatarFallback className="bg-white/20 text-white font-bold">
                                    {isMounted ? (user?.firstName?.split(' ').map(n => n[0]).join('').slice(0, 2) || "U") : "H"}
                                </AvatarFallback>
                            </UiAvatar>
                            <div className="flex flex-col overflow-hidden flex-1">
                                <p className="text-sm font-semibold text-white truncate">
                                    {isMounted ? user?.firstName : "HIT Guest"}
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
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings" className="flex items-center w-full cursor-pointer">
                                <Users className="mr-2 h-4 w-4" />
                                <span>Perfil</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings" className="flex items-center w-full cursor-pointer">
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
            <SheetContent side="left" className="p-0 border-none w-72">
                <Sidebar className="w-full h-full" />
            </SheetContent>
        </Sheet>
    )
}
