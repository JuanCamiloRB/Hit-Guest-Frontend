import { Metadata } from "next"
import { SettingsContent } from "./SettingsContent"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Page, PageHeader } from "@/components/ui/page"

export const metadata: Metadata = {
    title: "Configuración - Hit Guest",
    description: "Gestiona tu cuenta y equipo",
}

export default function SettingsPage() {
    return (
        <Page>
            <PageHeader title="Configuración" />
            <Suspense fallback={
                <div className="space-y-4">
                    <Skeleton className="h-10 w-75" />
                    <Skeleton className="h-100 w-full" />
                </div>
            }>
                <SettingsContent />
            </Suspense>
        </Page>
    )
}
