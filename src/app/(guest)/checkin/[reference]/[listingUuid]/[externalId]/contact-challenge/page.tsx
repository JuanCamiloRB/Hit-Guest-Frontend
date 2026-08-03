import { ContactChallengeScreen } from "@/features/checkin/components/ContactChallengeScreen"
import { redirect } from "next/navigation"

export default async function CheckinContactChallengeByExternalPage({
    params,
    searchParams
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
    searchParams: Promise<{guest_uuid?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    if (!resolvedSearchParams.guest_uuid) {
        redirect(`/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}/identify`)
    }

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`

    return (
        <ContactChallengeScreen
            reservationUuid={resolvedParams.reference}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
        />
    )
}
