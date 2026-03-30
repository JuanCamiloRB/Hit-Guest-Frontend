"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
    LayoutGrid,
    CalendarDays,
    Settings,
    Users,
    Menu,
    Home,
    Puzzle,
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
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Avatar as UiAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { Logo } from "@/components/ui/Logo"

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
            active: pathname?.startsWith("/dashboard/reservations"),
        },
        {
            label: "Propiedades",
            icon: Home,
            href: "/dashboard/properties",
            active: pathname?.startsWith("/dashboard/properties"),
        },
    ]

    const systemMenu = [
        {
            label: "Configuración",
            icon: Settings,
            href: "/dashboard/settings",
            active: pathname?.startsWith("/dashboard/settings"),
        },
    ]

    const renderMenuItems = (items: typeof mainMenu) => (
        <div className="space-y-2.5">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "group flex items-center px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 border",
                            item.active
                                ? "bg-white text-[var(--color-brand-purple)] shadow-2xl border-white/20"
                                : "bg-black/30 text-white hover:bg-black/50 border-white/5 hover:border-white/20"
                        )}
                    >
                        <Icon className={cn(
                            "mr-3 h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                            item.active ? "text-[var(--color-brand-purple)]" : "text-white/80 group-hover:text-white"
                        )} />
                        {item.label}
                    </Link>
                )
            })}
        </div>
    )

    if (!isMounted) return <div className={cn("hidden md:flex flex-col h-screen bg-brand-purple", className)} />;

    return (
        <div className={cn("flex flex-col h-screen bg-brand-purple text-white border-r border-white/10 shadow-2xl overflow-hidden", className)}>
            <ScrollArea className="flex-1 px-4">
                <div className="py-8 space-y-8">
                    {/* Logo Section */}
                    <div className="px-3 mb-6 flex items-center gap-3">
                         <Logo variant="full" className="text-white" showText={true} />
                    </div>

                    <section className="space-y-4">
                        <div className="px-4">
                            <span className="text-[13px] font-black uppercase tracking-widest text-white/90 block">
                                Menú Principal
                            </span>
                        </div>
                        {renderMenuItems(mainMenu)}
                    </section>

                    <section className="space-y-4">
                        <div className="px-4">
                            <span className="text-[13px] font-black uppercase tracking-widest text-white/90 block">
                                Sistema
                            </span>
                        </div>
                        {renderMenuItems(systemMenu)}
                    </section>
                </div>
            </ScrollArea>

            {/* Profile Footer */}
            <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full hover:bg-black/20 p-3 rounded-xl transition-all text-left focus:outline-none border border-white/5 hover:border-white/20 shadow-inner">
                            <UiAvatar className="h-10 w-10 border-2 border-white/20 shadow-lg">
                                <AvatarFallback className="bg-black/40 text-white font-bold">
                                    {user?.firstName ? user.firstName.slice(0, 2).toUpperCase() : "HG"}
                                </AvatarFallback>
                            </UiAvatar>
                            <div className="flex flex-col overflow-hidden flex-1">
                                <p className="text-sm font-bold text-white truncate">
                                    {user?.firstName || "Usuario"}
                                </p>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-tighter">
                                    {user?.role === 'PRINCIPAL' || user?.isPrincipal ? "Super Admin" : "Gestor"}
                                </p>
                            </div>
                            <MoreVertical className="h-4 w-4 text-white/40" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" side="top">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings?tab=profile" className="flex items-center w-full cursor-pointer">
                                <Users className="mr-2 h-4 w-4" />
                                <span>Perfil</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings?tab=client" className="flex items-center w-full cursor-pointer">
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
