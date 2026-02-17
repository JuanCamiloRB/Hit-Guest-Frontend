import { cn } from "@/lib/utils"

interface GuestLayoutProps {
    children: React.ReactNode
    className?: string
}

export default function GuestLayout({ children, className }: GuestLayoutProps) {
    return (
        <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-primary">Hit Guest</h1>
                    <p className="text-sm text-muted-foreground">Welcome to your stay</p>
                </div>
                <main className={cn("w-full", className)}>
                    {children}
                </main>
            </div>
        </div>
    )
}
