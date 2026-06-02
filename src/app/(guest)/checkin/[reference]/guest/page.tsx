import { GuestFormScreen } from "@/features/checkin/components/GuestFormScreen"

export default async function CheckinGuestByUuidPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;

    const basePath = `/checkin/${resolvedParams.reference}`

    return <GuestFormScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
}
