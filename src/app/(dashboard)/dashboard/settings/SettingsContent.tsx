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
import { Users, User, Building2 } from "lucide-react"
import { ClientSettings } from "@/features/clients/components/ClientSettings"
import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export function SettingsContent() {
    const { user, isLoading } = useAuth()
    const searchParams = useSearchParams()
    const tabParam = searchParams.get("tab")
    const [activeTab, setActiveTab] = useState("profile")

    useEffect(() => {
        if (tabParam && ["profile", "client", "team"].includes(tabParam)) {
            setActiveTab(tabParam)
        }
    }, [tabParam])

    if (isLoading || !user) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-[300px]" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={cn(
                "grid w-full h-auto bg-slate-100/50 p-1 border border-slate-200/60 rounded-xl shadow-sm",
                user.isPrincipal ? "grid-cols-3 lg:w-[600px]" : "grid-cols-1 lg:w-[200px]"
            )}>
                <TabsTrigger
                    value="profile"
                    className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                >
                    <User className={cn(
                        "mr-2 h-4 w-4 transition-colors",
                        activeTab === "profile" ? "text-white" : "text-[var(--color-brand-purple)]"
                    )} />
                    <span className="font-bold">Mi Perfil</span>
                </TabsTrigger>
                {user.isPrincipal && (
                    <>
                        <TabsTrigger
                            value="client"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Building2 className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "client" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Alojamiento</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Users className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "team" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Usuarios</span>
                        </TabsTrigger>
                    </>
                )}
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Mi Perfil</CardTitle>
                        <CardDescription>
                            Actualiza tu información personal y cuenta de acceso.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProfileForm user={user} />
                    </CardContent>
                </Card>
            </TabsContent>

            {user.isPrincipal && (
                <>
                    <TabsContent value="client" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información del Alojamiento</CardTitle>
                                <CardDescription>
                                    Gestiona los datos fiscales y de contacto de tu hotel o empresa.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ClientSettings clientId={user.clientId} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="team" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Gestión de Equipo</CardTitle>
                                <CardDescription>
                                    Administra los usuarios secundarios y sus permisos.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <UserManagement />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </>
            )}
        </Tabs>
    )
}
