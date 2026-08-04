"use client"

import { cn } from "@/lib/utils"
import { ProfileForm } from "@/features/auth/components/ProfileForm"
import { UserManagement } from "@/features/users/components/UserManagement"
import { IntegrationsHub } from "@/features/integrations/components/IntegrationsHub"
import { BillingSettings } from "@/features/billing/components/BillingSettings"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    User,
    Users,
    Plug,
    CreditCard,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

const SETTINGS_TABS = [
    { id: "profile", label: "Mi cuenta", icon: User },
    { id: "team", label: "Usuarios", icon: Users, adminOnly: true },
    { id: "integrations", label: "Integraciones", icon: Plug, adminOnly: true },
    { id: "billing", label: "Facturación", icon: CreditCard, adminOnly: true },
]

export function SettingsContent() {
    const { user, isLoading } = useAuth()
    const searchParams = useSearchParams()
    const tabParam = searchParams.get("tab")
    const [activeTab, setActiveTab] = useState("profile")
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (tabParam && SETTINGS_TABS.some(t => t.id === tabParam)) {
            setActiveTab(tabParam)
        }
    }, [tabParam])

    // Break out of loading loop if user data is already hydrated from store
    if (!isMounted || (isLoading && !user)) {
        return (
            <div className="flex flex-col md:flex-row gap-8 items-start animate-in fade-in duration-500">
                {/* Sidebar Skeleton */}
                <div className="w-full md:w-64 h-[320px] bg-slate-200/60 rounded-[2.5rem] animate-pulse shadow-sm shadow-black/5" />
                
                {/* Content Skeleton */}
                <div className="flex-1 h-[600px] bg-slate-200/60 rounded-[2.5rem] animate-pulse shadow-sm shadow-black/5" />
            </div>
        )
    }

    if (!user) return null // Safety check for TS

    const filteredTabs = SETTINGS_TABS.filter(tab => !tab.adminOnly || user.isPrincipal)

    return (
        <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Vertical Sidebar Navigation */}
            <aside className="w-full md:w-64 space-y-2 flex-shrink-0">
                <p className="px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-4">
                    CONFIGURACIÓN
                </p>
                <div className="flex flex-col space-y-1">
                    {filteredTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-xl group relative text-left w-full",
                                activeTab === tab.id
                                    ? "bg-white text-[var(--color-brand-purple)] shadow-sm border border-slate-100"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            )}
                        >
                            <tab.icon className={cn(
                                "h-4 w-4 transition-colors",
                                activeTab === tab.id ? "text-[var(--color-brand-purple)]" : "text-slate-400 group-hover:text-slate-600"
                            )} />
                            <span>{tab.label}</span>
                            {activeTab === tab.id && (
                                <div className="absolute right-3 h-1 w-1 rounded-full bg-[var(--color-brand-purple)]" />
                            )}
                        </button>
                    ))}
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 w-full min-w-0">
                <Card className="border-none shadow-sm shadow-black/5 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-100 pb-6">
                        <CardTitle className="text-2xl font-bold">
                            {filteredTabs.find(t => t.id === activeTab)?.label}
                        </CardTitle>
                        <CardDescription>
                            {activeTab === "profile" && "Actualiza tu información personal y cuenta de acceso."}
                            {activeTab === "team" && "Administra los usuarios secundarios y sus permisos."}
                            {activeTab === "integrations" && "Conecta tus PMS y canales de venta desde un solo lugar."}
                            {activeTab === "billing" && "Consulta tu saldo, recarga créditos y revisa tus transacciones."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8">
                        {activeTab === "profile" && <ProfileForm user={user} />}
                        {activeTab === "team" && <UserManagement />}
                        {activeTab === "integrations" && <IntegrationsHub />}
                        {activeTab === "billing" && <BillingSettings />}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
