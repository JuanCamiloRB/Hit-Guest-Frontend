import { Metadata } from "next"
import { AdminAccessGate } from "@/features/admin/components/AdminAccessGate"
import { ClientAccountView } from "@/features/admin/components/ClientAccountView"

export const metadata: Metadata = {
    title: "Cuenta del cliente - Hit Guest",
    description: "Usuarios de la cuenta y entrada a la cuenta (superusuario)",
}

export default async function AdminClientPage({ params }: { params: Promise<{ clientUuid: string }> }) {
    const { clientUuid } = await params
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <AdminAccessGate>
                <ClientAccountView clientUuid={clientUuid} />
            </AdminAccessGate>
        </div>
    )
}
