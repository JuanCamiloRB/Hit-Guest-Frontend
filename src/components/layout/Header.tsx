"use client"

import { MobileSidebar } from "./Sidebar"
import {
    Search,
    Bell,
    CircleHelp,
    CircleUserRound,
    Package2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import * as React from "react"

export function Header() {
    const { user, logout } = useAuth()
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white px-4 md:px-8 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <MobileSidebar />
                    <div className="hidden md:flex items-center gap-2 text-primary">
                        <Package2 className="h-6 w-6" />
                        <h1 className="text-lg font-bold tracking-tight text-slate-900">HIT Guest</h1>
                    </div>
                    {/* Mobile title */}
                    <h1 className="md:hidden text-lg font-bold tracking-tight text-slate-900">HIT Guest</h1>
                </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-4 md:gap-6">
                {/* Search Bar */}
                <div className="relative hidden lg:flex items-center max-w-sm w-full">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar..."
                        className="pl-9 bg-slate-50 border border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {/* Profile Button / Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="rounded-lg bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-4">
                                <CircleUserRound className="h-5 w-5" />
                                <span className="hidden sm:inline font-medium text-sm text-[13px]">Perfil Admin</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {isMounted ? `${user?.firstName} ${user?.lastName}` : "Cargando..."}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {isMounted ? user?.email : ""}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Mi Perfil</DropdownMenuItem>
                            <DropdownMenuItem>Configuración</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={logout}
                            >
                                Cerrar Sesión
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Notification & Help */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 bg-slate-100/50 hover:bg-slate-100 rounded-lg">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 bg-slate-100/50 hover:bg-slate-100 rounded-lg">
                            <CircleHelp className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    )
}
