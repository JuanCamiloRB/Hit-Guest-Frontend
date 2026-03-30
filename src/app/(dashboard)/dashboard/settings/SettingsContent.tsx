"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ProfileForm } from "@/features/auth/components/ProfileForm"
import { UserManagement } from "@/features/users/components/UserManagement"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, User, Building2, Shield, CreditCard, Phone } from "lucide-react"
import { ClientSettings } from "@/features/clients/components/ClientSettings"
import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export function SettingsContent() {
    const { user, isLoading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const [isMounted, setIsMounted] = useState(false)
    const [activeTab, setActiveTab] = useState("profile")

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (isMounted && searchParams) {
            const tabParam = searchParams.get("tab")
            if (tabParam && ["profile", "client", "team", "whatsapp", "security", "notifications", "billing"].includes(tabParam)) {
                setActiveTab(tabParam)
            }
        }
    }, [isMounted, searchParams])

    if (!isMounted || authLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-[300px]" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 font-secondary">Acceso denegado</h3>
                <p className="text-slate-500 mt-2">No se encontró una sesión activa. Por favor, inicia sesión nuevamente.</p>
            </div>
        )
    }

    const menuItems = [
        { id: "profile", label: "Mi cuenta", icon: User, hidden: false },
        { id: "security", label: "Seguridad", icon: Shield, hidden: false },
        { id: "notifications", label: "Notificaciones", icon: Building2, hidden: false },
        { id: "billing", label: "Facturación", icon: CreditCard, hidden: false },
        { id: "client", label: "Alojamiento", icon: Building2, hidden: !user.isPrincipal },
        { id: "team", label: "Equipo", icon: Users, hidden: !user.isPrincipal },
        { id: "whatsapp", label: "WhatsApp", icon: Phone, hidden: !user.isPrincipal },
    ]

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[600px] mt-6 animate-in fade-in duration-500">
            {/* Vertical Sidebar Navigation */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-1">
                <div className="px-4 py-2 mb-2">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Configuración</h2>
                </div>
                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        if (item.hidden) return null;
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-bold",
                                    isActive 
                                        ? "bg-white text-[var(--color-brand-purple)] shadow-sm shadow-[var(--color-brand-purple)]/5 border border-slate-100" 
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                )}
                            >
                                <Icon className={cn(
                                    "h-4 w-4 transition-colors",
                                    isActive ? "text-[var(--color-brand-purple)]" : "text-slate-400 group-hover:text-slate-600"
                                )} />
                                {item.label}
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-brand-purple)] shadow-sm" />
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
                    {activeTab === "profile" && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">Mi Perfil</h1>
                                <p className="text-slate-500 text-sm mt-1">Actualiza tu información personal y cuenta de acceso.</p>
                            </div>
                            <ProfileForm user={user} />
                        </div>
                    )}

                    {activeTab === "client" && user.isPrincipal && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">Información del Alojamiento</h1>
                                <p className="text-slate-500 text-sm mt-1">Gestiona los datos de tu hotel o empresa.</p>
                            </div>
                            <ClientSettings clientId={user.clientId} />
                        </div>
                    )}

                    {activeTab === "team" && user.isPrincipal && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">Gestión de Equipo</h1>
                                <p className="text-slate-500 text-sm mt-1">Administra los usuarios secundarios y sus permisos.</p>
                            </div>
                            <UserManagement />
                        </div>
                    )}

                    {["security", "notifications", "billing", "whatsapp"].includes(activeTab) && (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                                <Building2 className="h-10 w-10 text-slate-200" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Sección en desarrollo</h3>
                                <p className="text-slate-500 max-w-xs mx-auto">Esta funcionalidad estará disponible muy pronto para tu cuenta.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
