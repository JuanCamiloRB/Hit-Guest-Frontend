import { Metadata } from "next"
import { Suspense } from "react"
import { SupportAccessGate } from "@/features/support/components/SupportAccessGate"
import { SupportConsole } from "@/features/support/components/SupportConsole"
import { Page, PageHeader } from "@/components/ui/page"

export const metadata: Metadata = {
    title: "Consola de soporte - Hit Guest",
    description: "Buscar clientes y entrar a su cuenta como uno de sus usuarios",
}

export default function SupportConsolePage() {
    return (
        <Page>
            <PageHeader
                title="Consola de soporte"
                description="Busca un cliente y entra a su cuenta como uno de sus usuarios."
            />
            <SupportAccessGate requires="console">
                {/* `useSearchParams` exige un límite de Suspense en una página estática. */}
                <Suspense fallback={null}>
                    <SupportConsole />
                </Suspense>
            </SupportAccessGate>
        </Page>
    )
}
