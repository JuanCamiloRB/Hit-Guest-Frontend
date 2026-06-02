import { GuestHeader } from "@/features/checkin/components/GuestHeader"

export default function CheckinLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <GuestHeader />
            <main className="flex-1 w-full max-w-lg mx-auto py-6 px-4">
                {children}
            </main>
        </div>
    )
}
