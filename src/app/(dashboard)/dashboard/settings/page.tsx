import { Metadata } from "next"
import { SettingsContent } from "./SettingsContent"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
    title: "Configuración - Hit Guest",
    description: "Gestiona tu cuenta y equipo",
}

export default function SettingsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
            </div>
            <Suspense fallback={
                <div className="space-y-4">
                    <Skeleton className="h-10 w-[300px]" />
                    <Skeleton className="h-[400px] w-full" />
                </div>
            }>
                <SettingsContent />
            </Suspense>
        </div>
    )
}
