import { Metadata } from "next"
import { SupportAccessGate } from "@/features/support/components/SupportAccessGate"
import { SupportAgentsManager } from "@/features/support/components/SupportAgentsManager"

export const metadata: Metadata = {
    title: "Agentes de soporte - Hit Guest",
    description: "Dar de alta y revocar agentes de soporte",
}

export default function SupportAgentsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Agentes de soporte</h2>
                <p className="text-sm text-slate-500">Quién puede entrar a las cuentas de los clientes.</p>
            </div>
            <SupportAccessGate requires="agents">
                <SupportAgentsManager />
            </SupportAccessGate>
        </div>
    )
}
