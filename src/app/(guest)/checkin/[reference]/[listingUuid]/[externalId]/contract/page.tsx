import { ContractScreen } from "@/features/checkin/components/ContractScreen"

export default async function CheckinContractByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;
    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`
    return <ContractScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
}
