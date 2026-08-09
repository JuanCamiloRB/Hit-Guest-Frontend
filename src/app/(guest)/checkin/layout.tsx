import { GuestHeader } from "@/features/checkin/components/GuestHeader"

export default function CheckinLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // min-h-dvh, no min-h-screen: en iOS Safari `100vh` es la altura CON la barra
    // de herramientas retraída, así que la página queda más alta que el área
    // visible y aparece scroll muerto al final de cada pantalla del portal.
    return (
        <div className="flex min-h-dvh flex-col bg-slate-50">
            <GuestHeader />
            <main className="flex-1 w-full max-w-lg mx-auto py-6 px-4">
                {children}
            </main>
        </div>
    )
}
