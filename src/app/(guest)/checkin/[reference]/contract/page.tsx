import { ContractScreen } from "@/features/checkin/components/ContractScreen"

export default async function CheckinContractPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;
    const basePath = `/checkin/${resolvedParams.reference}`
    return <ContractScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
}
