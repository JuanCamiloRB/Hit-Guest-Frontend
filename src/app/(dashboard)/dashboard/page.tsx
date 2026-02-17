"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/use-auth"

export default function DashboardPage() {
    const { logout } = useAuth()

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center space-y-6 text-center px-4">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl font-sans">
                    ¡Bienvenido a <span className="text-primary italic">HIT Guest</span>!
                </h1>
                <p className="text-xl text-muted-foreground max-w-[600px] mx-auto font-secondary">
                    Estamos preparando tu dashboard con las mejores herramientas para la gestión de tus propiedades.
                </p>
            </div>

            <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-xl border shadow-sm max-w-lg w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-1">
                    <p className="font-medium text-lg">Próximamente</p>
                    <p className="text-sm text-muted-foreground">
                        Métricas en tiempo real, calendario de reservas y gestión de ingresos.
                    </p>
                </div>

                <div className="w-full pt-4 border-t">
                    <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 w-full"
                        onClick={logout}
                    >
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </div>
            </div>
        </div>
    )
}
