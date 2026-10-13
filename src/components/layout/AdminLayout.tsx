import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { BalanceBanner } from "@/features/billing/components/BalanceBanner"
import { SupportSessionBanner } from "@/features/support/components/SupportSessionBanner"
import { AccountChromeOnly, SupportAgentRouteGuard } from "@/features/support/components/SupportAgentRouteGuard"

interface AdminLayoutProps {
    children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-background">
            {/* Desktop Sidebar */}
            <aside className="sticky top-0 hidden w-64 h-screen md:block flex-shrink-0 z-20">
                <Sidebar className="w-full h-full" />
            </aside>

            <div className="flex flex-1 flex-col min-w-0">
                <SupportSessionBanner />
                <Header />
                <AccountChromeOnly>
                    <BalanceBanner />
                </AccountChromeOnly>
                <main className="flex-1 p-2 sm:p-4 md:p-6 bg-muted/10">
                    <SupportAgentRouteGuard>{children}</SupportAgentRouteGuard>
                </main>
            </div>
        </div>
    )
}
