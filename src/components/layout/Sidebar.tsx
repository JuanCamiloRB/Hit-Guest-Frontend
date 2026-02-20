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
    Zap,
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
            label: "Automatizaciones",
            icon: Zap,
            href: "/dashboard/automations",
            active: pathname.startsWith("/dashboard/automations"),
        },
        {
            label: "Propiedades",
            icon: Home,
            href: "/dashboard/properties",
            active: pathname.startsWith("/dashboard/properties"),
        },
        {
            label: "Huéspedes",
            icon: Users,
            href: "/dashboard/guests",
            active: pathname.startsWith("/dashboard/guests"),
        },
    ]

    const systemMenu = [
        {
            label: "Configuración",
            icon: Settings,
            href: "/dashboard/settings",
            active: pathname.startsWith("/dashboard/settings"),
        },
        {
            label: "Integraciones",
            icon: Puzzle,
            href: "/dashboard/integrations",
            active: pathname.startsWith("/dashboard/integrations"),
        },
    ]

    const renderMenuItems = (items: typeof mainMenu) => (
        <div className="space-y-1">
            {items.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        item.active
                            ? "bg-purple-heart text-white"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                    )}
                >
                    <item.icon className={cn(
                        "mr-3 h-5 w-5",
                        item.active ? "text-white" : "text-white/60 group-hover:text-white"
                    )} />
                    {item.label}
                </Link>
            ))}
        </div>
    )

    return (
        <div className={cn("flex flex-col h-screen bg-primary text-white border-r border-white/10", className)}>
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
                {/* Logo Section can be here or in Header, image 2 doesn't show it at the top of the menu itself but image 1 shows it in header */}

                <section className="space-y-4">
                    <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Menú Principal
                    </h3>
                    {renderMenuItems(mainMenu)}
                </section>

                <section className="space-y-4">
                    <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Sistema
                    </h3>
                    {renderMenuItems(systemMenu)}
                </section>
            </div>

            {/* Profile Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 w-full hover:bg-white/5 p-2 rounded-lg transition-colors text-left focus:outline-none">
                            <UiAvatar className="h-10 w-10 border border-white/20">
                                <AvatarFallback className="bg-white/20 text-white font-bold">
                                    {isMounted ? (user?.firstName?.[0] || "J") : "H"}
                                    {isMounted ? (user?.lastName?.[0] || "D") : "G"}
                                </AvatarFallback>
                            </UiAvatar>
                            <div className="flex flex-col overflow-hidden flex-1">
                                <p className="text-sm font-semibold text-white truncate">
                                    {isMounted ? `${user?.firstName} ${user?.lastName}` : "HIT Guest"}
                                </p>
                                <p className="text-[10px] font-medium text-white/50 uppercase tracking-tight">
                                    {isMounted ? "Super Admin" : "Cargando..."}
                                </p>
                            </div>
                            <MoreVertical className="h-4 w-4 text-white/40" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" side="top">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Perfil</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Configuración</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
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
