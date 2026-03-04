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
import { ProfileForm } from "@/features/auth/components/ProfileForm"
import { UserManagement } from "@/features/users/components/UserManagement"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, User, Building2 } from "lucide-react"
import { ClientSettings } from "@/features/clients/components/ClientSettings"

export function SettingsContent() {
    const { user, isLoading } = useAuth()

    if (isLoading || !user) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-[300px]" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    return (
        <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="profile">
                    <User className="mr-2 h-4 w-4" />
                    Mi Perfil
                </TabsTrigger>
                {user.isPrincipal && (
                    <>
                        <TabsTrigger value="client">
                            <Building2 className="mr-2 h-4 w-4" />
                            Alojamiento
                        </TabsTrigger>
                        <TabsTrigger value="team">
                            <Users className="mr-2 h-4 w-4" />
                            Equipo
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
