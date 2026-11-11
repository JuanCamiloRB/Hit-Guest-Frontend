import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader"
import { BillingDashboard } from "@/features/dashboard/components/BillingDashboard"

export default function DashboardPage() {
    return (
        // Sin padding propio: el de AdminLayout ya lo da (se sumaban los dos).
        <div className="mx-auto flex w-full max-w-400 flex-col gap-8">
            <DashboardHeader />

            {/* The Tablero focuses on billing/consumption (cost per reservation,
                account balance, recharge) — the operational reservations list
                lives on the Operaciones page, not here, to avoid duplication. */}
            <BillingDashboard />
        </div>
    )
}
