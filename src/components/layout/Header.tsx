"use client"

import * as React from "react"
import Link from "next/link"
import { MobileSidebar } from "./Sidebar"
import {
    Search,
    Bell,
    CircleHelp,
    CircleUserRound,
    Building2,
    Users,
    LogOut,
    Languages,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useLanguageStore } from "@/store/useLanguageStore"
import { useTranslation } from "@/hooks/useTranslation"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/ui/Logo"

export function Header() {
    const { user, logout } = useAuth()
    const { language, setLanguage } = useLanguageStore()
    const { t } = useTranslation()
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white px-4 md:px-8 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <MobileSidebar />
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <Logo variant="full" className="text-primary" />
                    </Link>
                </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-4 md:gap-6">
                {/* Search Bar */}
                <div className="relative hidden lg:flex items-center max-w-sm w-full">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('common.search')}
                        className="pl-9 bg-slate-50 border border-slate-200 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {/* Language Switcher */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-10 w-auto px-3 gap-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 uppercase text-xs font-bold tracking-wider">
                                <Languages className="h-4 w-4" />
                                {isMounted ? language : "EN"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem 
                                onClick={() => setLanguage('es')}
                                className={isMounted && language === 'es' ? "bg-primary/10 font-medium" : ""}
                            >
                                Español (ES)
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => setLanguage('en')}
                                className={isMounted && language === 'en' ? "bg-primary/10 font-medium" : ""}
                            >
                                English (EN)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Profile Button / Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="rounded-lg bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-4">
                                <CircleUserRound className="h-5 w-5" />
                                <span className="hidden sm:inline font-medium text-sm text-[13px]">
                                    {isMounted ? user?.firstName : t('common.loading')}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {isMounted ? user?.firstName : t('common.loading')}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {isMounted ? user?.email : ""}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/settings?tab=profile" className="cursor-pointer">
                                    <CircleUserRound className="mr-2 h-4 w-4" />
                                    <span>{t('header.myProfile')}</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/settings?tab=client" className="cursor-pointer">
                                    <Building2 className="mr-2 h-4 w-4" />
                                    <span>{t('header.accommodation')}</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/settings?tab=team" className="cursor-pointer">
                                    <Users className="mr-2 h-4 w-4" />
                                    <span>{t('header.users')}</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={logout}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>{t('header.logout')}</span>
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
