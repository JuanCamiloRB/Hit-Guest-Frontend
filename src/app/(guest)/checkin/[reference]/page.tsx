import { WelcomeScreen } from "@/features/checkin/components/WelcomeScreen"
import { checkinService } from "@/features/checkin/services/checkin-service"

export default async function CheckinByUuidPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;

    try {
        const portal = await checkinService.getPortal(resolvedParams.reference)
        const basePath = `/checkin/${resolvedParams.reference}`

        return <WelcomeScreen portal={portal} basePath={basePath} />
    } catch (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Reserva no encontrada</h1>
                <p className="text-slate-500">No pudimos encontrar la reserva o el link ha expirado.</p>
            </div>
        )
    }
}
