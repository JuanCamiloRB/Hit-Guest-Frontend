import { GuestDocumentScreen } from "@/features/checkin/components/GuestDocumentScreen"

/**
 * Guest-facing document view (Pantalla 3).
 * URL: /checkin/{reservationUuid}/documents/{documentUuid}
 *
 * Uses the same auth dynamic as the rest of the checkin flow:
 * app token via raw fetch — no PM session required.
 */
export default async function GuestDocumentPage({
    params,
}: {
    params: Promise<{ reference: string; documentUuid: string }>
}) {
    const { reference, documentUuid } = await params

    return (
        <GuestDocumentScreen
            reservationUuid={reference}
            documentUuid={documentUuid}
            basePath={`/checkin/${reference}`}
        />
    )
}
