import { VerifyScreen } from "@/features/checkin/components/VerifyScreen"
import { redirect } from "next/navigation"

export default async function CheckinVerifyPage({ 
    params,
    searchParams
}: { 
    params: Promise<{reference: string}>
    searchParams: Promise<{guest_uuid?: string; from_didit_callback?: string; didit_error?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    if (!resolvedSearchParams.guest_uuid) {
        redirect(`/checkin/${resolvedParams.reference}/identify`)
    }

    const basePath = `/checkin/${resolvedParams.reference}`
    const fromCallback = resolvedSearchParams.from_didit_callback === '1'

    return (
        <VerifyScreen
            reservationUuid={resolvedParams.reference}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
            fromCallback={fromCallback}
        />
    )
}
