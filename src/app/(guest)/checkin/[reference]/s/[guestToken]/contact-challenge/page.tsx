import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { ContactChallengeScreen } from "@/features/checkin/components/ContactChallengeScreen"

export const metadata: Metadata = {
    title: "Verificación | Hit Guest",
}

export default async function SecondaryContactChallengePage({
    params,
    searchParams
}: {
    params: Promise<{reference: string; guestToken: string}>
    searchParams: Promise<{guest_uuid?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    try {
        if (!resolvedSearchParams.guest_uuid) {
            redirect(`/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}/identify`)
        }

        const status = await checkinService.getSecondaryGateStatus(resolvedParams.reference, resolvedParams.guestToken)
        if (!status.mainGuestCompleted) return notFound()

        const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`
        return (
            <ContactChallengeScreen
                reservationUuid={resolvedParams.reference}
                guestUuid={resolvedSearchParams.guest_uuid!}
                basePath={basePath}
                isSecondary={true}
            />
        )
    } catch (error) {
        if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error;
        return notFound()
    }
}
