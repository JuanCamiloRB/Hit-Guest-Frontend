import { GuestFormScreen } from "@/features/checkin/components/GuestFormScreen"

export default async function CheckinGuestByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`

    return <GuestFormScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
}
