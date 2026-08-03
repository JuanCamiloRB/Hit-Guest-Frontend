import { ContactChallengeScreen } from "@/features/checkin/components/ContactChallengeScreen"
import { redirect } from "next/navigation"

export default async function CheckinContactChallengePage({
    params,
    searchParams
}: {
    params: Promise<{reference: string}>
    searchParams: Promise<{guest_uuid?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    if (!resolvedSearchParams.guest_uuid) {
        redirect(`/checkin/${resolvedParams.reference}/identify`)
    }

    const basePath = `/checkin/${resolvedParams.reference}`

    return (
        <ContactChallengeScreen
            reservationUuid={resolvedParams.reference}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
        />
    )
}
