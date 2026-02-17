import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface AdminLayoutProps {
    children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 md:block flex-shrink-0">
                <Sidebar className="w-full" />
            </aside>

            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/10">
                    {children}
                </main>
            </div>
        </div>
    )
}
