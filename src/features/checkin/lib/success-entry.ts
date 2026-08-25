import type { RegisteredGuest } from "../types/checkin"

export type SuccessEntryReason = "identity_already_completed" | "completion_already_recorded"

export function buildCompletedCheckinHref(
    basePath: string,
    guestUuid: string,
    reason: SuccessEntryReason,
): string {
    const params = new URLSearchParams({ guest_uuid: guestUuid, entry: reason })
    return `${basePath}/success?${params.toString()}`
}

/**
 * Query parameters preserve navigation context, not business state. The special
 * presentation is enabled only if the portal independently confirms that the
 * same guest has a completed check-in.
 */
export function resolveCompletedEntryReason(
    rawReason: string | null,
    guestUuid: string | null,
    guests: RegisteredGuest[] | undefined,
): SuccessEntryReason | null {
    if (
        rawReason !== "identity_already_completed"
        && rawReason !== "completion_already_recorded"
    ) return null
    if (!guestUuid || !guests?.some(guest => guest.uuid === guestUuid && guest.isCompleted)) return null
    return rawReason
}

export function completedEntryCopy(reason: SuccessEntryReason): {
    title: string
    description: string
} {
    if (reason === "identity_already_completed") {
        return {
            title: "Este check-in ya estaba completado",
            description: "El tipo y número de documento que ingresaste ya están registrados en esta reserva. No necesitas repetir el proceso.",
        }
    }
    return {
        title: "Este check-in ya estaba completado",
        description: "El registro de este huésped ya había sido completado. No necesitas enviarlo nuevamente.",
    }
}
