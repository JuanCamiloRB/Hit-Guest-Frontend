import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { BalanceBanner } from "@/features/billing/components/BalanceBanner"
import { SupportSessionBanner } from "@/features/support/components/SupportSessionBanner"
import { AccountChromeOnly, SupportAgentRouteGuard } from "@/features/support/components/SupportAgentRouteGuard"
import { SidebarProvider, SidebarRoot } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

interface AdminLayoutProps {
    children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <TooltipProvider>
            <SidebarProvider>
                <div className="flex min-h-screen flex-col md:flex-row bg-background">
                    {/* Escritorio: la barra lateral, ancha o contraída según la preferencia guardada. */}
                    <SidebarRoot className="sticky top-0 z-20 hidden md:flex">
                        <Sidebar className="w-full h-full" />
                    </SidebarRoot>

                    <div className="flex flex-1 flex-col min-w-0">
                        <SupportSessionBanner />
                        <Header />
                        <AccountChromeOnly>
                            <BalanceBanner />
                        </AccountChromeOnly>
                        <main className="flex-1 p-2 sm:p-4 md:p-6 bg-sunk/10">
                            <SupportAgentRouteGuard>{children}</SupportAgentRouteGuard>
                        </main>
                    </div>
                </div>
            </SidebarProvider>
        </TooltipProvider>
    )
}
