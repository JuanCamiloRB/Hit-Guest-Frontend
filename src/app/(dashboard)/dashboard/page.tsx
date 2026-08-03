import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader"
import { BillingDashboard } from "@/features/dashboard/components/BillingDashboard"

export default function DashboardPage() {
    return (
        <div className="flex flex-col gap-6 sm:gap-8 p-3 sm:p-6 lg:p-10">
            <DashboardHeader />

            {/* The Tablero focuses on billing/consumption (cost per reservation,
                account balance, recharge) — the operational reservations list
                lives on the Operaciones page, not here, to avoid duplication. */}
            <BillingDashboard />
        </div>
    )
}
