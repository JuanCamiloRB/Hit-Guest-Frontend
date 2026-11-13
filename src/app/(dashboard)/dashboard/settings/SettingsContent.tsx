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
    CardHeader } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import {
    User,
    Users,
    Plug,
    CreditCard,
} from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Overline } from "@/components/ui/overline"
import { Skeleton } from "@/components/ui/skeleton"

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
                <Skeleton className="w-full md:w-64 h-80 rounded-xl" />
                
                {/* Content Skeleton */}
                <Skeleton className="flex-1 h-150 rounded-xl" />
            </div>
        )
    }

    if (!user) return null // Safety check for TS

    const filteredTabs = SETTINGS_TABS.filter(tab => !tab.adminOnly || user.isPrincipal)

    return (
        <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Vertical Sidebar Navigation */}
            <aside className="w-full md:w-64 space-y-2 flex-shrink-0">
                <Overline className="mb-4 px-4">Configuración</Overline>
                <div className="flex flex-col space-y-1">
                    {filteredTabs.map((tab) => (
                        <UnstyledButton
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-xl group relative text-left w-full",
                                activeTab === tab.id
                                    ? "bg-card text-primary shadow-sm border border-rule"
                                    : "text-ink-3 hover:text-ink hover:bg-sunk/50"
                            )}
                        >
                            <Icon icon={tab.icon} className={cn(
                                "transition-colors",
                                activeTab === tab.id ? "text-primary" : "text-ink-3 group-hover:text-ink-2"
                            )} />
                            <span>{tab.label}</span>
                            {activeTab === tab.id && (
                                <div className="absolute right-3 h-1 w-1 rounded-full bg-primary" />
                            )}
                        </UnstyledButton>
                    ))}
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 w-full min-w-0">
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-rule pb-6">
                        <Heading level={2} size="title">
                            {filteredTabs.find(t => t.id === activeTab)?.label}
                        </Heading>
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
