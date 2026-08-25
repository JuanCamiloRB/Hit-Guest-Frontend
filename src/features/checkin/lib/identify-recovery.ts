import type { RegisteredGuest } from "../types/checkin"

/**
 * Finds a guest that can be resumed without guessing their identity.
 *
 * The portal does not expose document type/number, so name matching is not a
 * valid substitute for the idempotency key used by `/identify`. Main is unique
 * by contract; a secondary is recoverable only when its UUID came from the
 * backend in the route.
 */
export function findRecoverableGuest(
    guests: RegisteredGuest[] | undefined,
    isMainGuest: boolean,
    resumeGuestUuid?: string,
): RegisteredGuest | undefined {
    if (isMainGuest) return guests?.find((guest) => guest.isMain)
    if (!resumeGuestUuid) return undefined
    return guests?.find((guest) => !guest.isMain && guest.uuid === resumeGuestUuid)
}
