import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader"
import { BillingDashboard } from "@/features/dashboard/components/BillingDashboard"
import { Page, PageHeader } from "@/components/ui/page"

export default function DashboardPage() {
    return (
        <Page>
            <DashboardHeader />

            {/* The Tablero focuses on billing/consumption (cost per reservation,
                account balance, recharge) — the operational reservations list
                lives on the Operaciones page, not here, to avoid duplication. */}
            <BillingDashboard />
        </Page>
    )
}
