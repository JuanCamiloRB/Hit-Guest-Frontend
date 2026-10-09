import { Metadata } from "next"
import { Suspense } from "react"
import { AdminAccessGate } from "@/features/admin/components/AdminAccessGate"
import { ClientsDirectory } from "@/features/admin/components/ClientsDirectory"

export const metadata: Metadata = {
    title: "Clientes - Hit Guest",
    description: "Directorio de cuentas de HitGuest (superusuario)",
}

export default function AdminClientsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
                <p className="text-sm text-slate-500">Todas las cuentas de HitGuest.</p>
            </div>
            <AdminAccessGate>
                {/* `useSearchParams` exige un límite de Suspense en una página estática. */}
                <Suspense fallback={null}>
                    <ClientsDirectory />
                </Suspense>
            </AdminAccessGate>
        </div>
    )
}
