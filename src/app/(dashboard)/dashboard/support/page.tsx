import { Metadata } from "next"
import { Suspense } from "react"
import { SupportAccessGate } from "@/features/support/components/SupportAccessGate"
import { SupportConsole } from "@/features/support/components/SupportConsole"

export const metadata: Metadata = {
    title: "Consola de soporte - Hit Guest",
    description: "Buscar clientes y entrar a su cuenta como uno de sus usuarios",
}

export default function SupportConsolePage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Consola de soporte</h2>
                <p className="text-sm text-slate-500">Busca un cliente y entra a su cuenta como uno de sus usuarios.</p>
            </div>
            <SupportAccessGate requires="console">
                {/* `useSearchParams` exige un límite de Suspense en una página estática. */}
                <Suspense fallback={null}>
                    <SupportConsole />
                </Suspense>
            </SupportAccessGate>
        </div>
    )
}
