import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { BalanceBanner } from "@/features/billing/components/BalanceBanner"
import { SupportSessionBanner } from "@/features/support/components/SupportSessionBanner"
import { AccountChromeOnly, SupportAgentRouteGuard } from "@/features/support/components/SupportAgentRouteGuard"
import { cookies } from "next/headers"
import { SidebarProvider, SidebarRoot } from "@/components/ui/sidebar"
import { SIDEBAR_COOKIE_COLLAPSED, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-preference"
import { TooltipProvider } from "@/components/ui/tooltip"

interface AdminLayoutProps {
    children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
    // La preferencia viaja en una cookie para pintar la barra ya contraída desde
    // el servidor: sin esto, el primer HTML era ancho y saltaba al hidratar.
    const cookieStore = await cookies()
    const defaultCollapsed = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value === SIDEBAR_COOKIE_COLLAPSED
    return (
        <TooltipProvider>
            <SidebarProvider defaultCollapsed={defaultCollapsed}>
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
