import { cn } from "@/lib/utils"
import { Heading } from "@/components/ui/heading"

interface GuestLayoutProps {
    children: React.ReactNode
    className?: string
}

export default function GuestLayout({ children, className }: GuestLayoutProps) {
    return (
        <div className="min-h-screen bg-sunk/30 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center text-center">
                    <Heading level={1}>Hit Guest</Heading>
                    <p className="text-sm text-ink-3">Welcome to your stay</p>
                </div>
                <main className={cn("w-full", className)}>
                    {children}
                </main>
            </div>
        </div>
    )
}
