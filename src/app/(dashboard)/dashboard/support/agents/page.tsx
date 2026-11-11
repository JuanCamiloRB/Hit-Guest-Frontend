import { Metadata } from "next"
import { SupportAccessGate } from "@/features/support/components/SupportAccessGate"
import { SupportAgentsManager } from "@/features/support/components/SupportAgentsManager"
import { Page, PageHeader } from "@/components/ui/page"

export const metadata: Metadata = {
    title: "Agentes de soporte - Hit Guest",
    description: "Dar de alta y revocar agentes de soporte",
}

export default function SupportAgentsPage() {
    return (
        <Page>
            <PageHeader
                title="Agentes de soporte"
                description="Quién puede entrar a las cuentas de los clientes."
            />
            <SupportAccessGate requires="agents">
                <SupportAgentsManager />
            </SupportAccessGate>
        </Page>
    )
}
