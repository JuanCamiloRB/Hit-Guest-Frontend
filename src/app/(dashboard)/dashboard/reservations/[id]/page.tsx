import { Metadata } from "next"
import { OperationsPanel } from "@/features/reservations/components/OperationsPanel"

export const metadata: Metadata = {
    title: "Reservation Operations - Hit Guest",
    description: "Detailed reservation management and automation status",
}

interface ReservationPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function ReservationDetailPage({ params }: ReservationPageProps) {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <OperationsPanel reservationId={id} />
        </div>
    )
}
