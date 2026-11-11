"use client"

import * as React from "react"
import Link from "next/link"
import { MobileSidebar } from "./Sidebar"
import {
    CircleUserRound,
    Users,
    LogOut,
    Languages,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"
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
import { BalanceWidget } from "@/features/billing/components/BalanceWidget"
import { useIsSupportAgentOnly } from "@/features/support/hooks/useIsSupportAgentOnly"
import { SUPPORT_HOME } from "@/features/support/lib/support-session"
import {
    AVAILABLE_LANGUAGES,
    DEFAULT_LANGUAGE,
    type Language,
} from "@/lib/i18n/dictionaries"

const LANGUAGE_LABELS: Record<Language, string> = {
    es: "Español (ES)",
    en: "English (EN)",
}

export function Header() {
    const { user, logout, isInSupportSession } = useAuth()
    const { language, setLanguage } = useLanguageStore()
    const { t } = useTranslation()
    const isMounted = useHasHydrated()
    // El agente puro no tiene panel de cuenta: ni saldo, ni perfil, ni usuarios
    // (son los de la cuenta interna de HIT). Su inicio es la consola.
    const agentOnly = useIsSupportAgentOnly()

    return (
        <header className="sticky top-0 z-30 flex h-14 sm:h-20 w-full items-center justify-between border-b bg-white/80 backdrop-blur-md px-3 sm:px-6 md:px-10 shadow-sm transition-all duration-300">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                    <MobileSidebar />
                    <Link href={agentOnly ? SUPPORT_HOME : "/dashboard"} className="hidden md:block transition-transform hover:scale-[1.02] active:scale-[0.98]">
                        {/* HIT GUEST: ícono + wordmark, menor que el HIT del
                            sidebar (pedido 2026-08-27). */}
                        <Logo variant="full" />
                    </Link>
                </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4 md:gap-8">
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
                    {/* Prepaid balance chip → billing */}
                    {!agentOnly && <BalanceWidget />}

                    {/* Selector de idioma: solo con un segundo idioma de verdad.
                        Con uno solo, ofrecer «English» (aunque fuera deshabilitado,
                        «Próximamente») prometía una interfaz que no existe: la app
                        está escrita en español fuera de un puñado de cadenas.
                        Vuelve solo al agregar "en" a `AVAILABLE_LANGUAGES`. */}
                    {AVAILABLE_LANGUAGES.length > 1 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    aria-label="Idioma de la interfaz"
                                    className="hidden sm:inline-flex h-10 w-auto px-3 gap-2 text-ink-2 bg-sunk/50 hover:bg-sunk rounded-lg border border-rule text-xs font-bold"
                                >
                                    <Languages className="h-4 w-4" aria-hidden />
                                    {isMounted ? language : DEFAULT_LANGUAGE}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {AVAILABLE_LANGUAGES.map((code) => (
                                    <DropdownMenuItem
                                        key={code}
                                        onClick={() => setLanguage(code)}
                                        className={isMounted && language === code ? "bg-primary/10 font-medium" : ""}
                                    >
                                        {LANGUAGE_LABELS[code]}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Profile Button / Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="rounded-lg bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-4">
                                <CircleUserRound className="h-5 w-5" />
                                <span className="hidden sm:inline font-medium text-sm text-sm">
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
                            {!agentOnly && (
                                <>
                                    <DropdownMenuItem asChild>
                                        <Link href="/dashboard/settings?tab=profile" className="cursor-pointer">
                                            <CircleUserRound className="mr-2 h-4 w-4" />
                                            <span>{t('header.myProfile')}</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/dashboard/settings?tab=team" className="cursor-pointer">
                                            <Users className="mr-2 h-4 w-4" />
                                            <span>{t('header.users')}</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={logout}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>{isInSupportSession ? "Salir del modo soporte" : t('header.logout')}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}
