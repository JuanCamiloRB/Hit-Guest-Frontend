import { Metadata } from "next"
import { DEFAULT_LANGUAGE, dictionaries } from "@/lib/i18n/dictionaries"
import { OperationsPanel } from "@/features/reservations/components/OperationsPanel"

// La pestaña se arma en el servidor, donde no existe el idioma elegido por el
// PM (vive en el navegador): manda el idioma por defecto.
export const metadata: Metadata = dictionaries[DEFAULT_LANGUAGE].meta.reservation

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
