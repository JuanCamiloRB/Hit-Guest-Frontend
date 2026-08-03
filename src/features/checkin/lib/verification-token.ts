/**
 * `verificationToken` storage (OTP plan 20260731 — "Dónde guardar el
 * verificationToken en el cliente"). sessionStorage, NOT localStorage: the
 * token is session-scoped, expires in 60 minutes server-side, and must not
 * survive across tabs/devices — unlike the rest of the checkin session data
 * (identify session, form drafts), which intentionally does use localStorage
 * to survive a closed tab.
 *
 * Keyed per reservationUuid + guestUuid (a companion of the same reservation
 * gets their own independent token).
 */

function storageKey(reservationUuid: string, guestUuid: string): string {
    return `checkin-verification-token-${reservationUuid}-${guestUuid}`
}

export function getVerificationToken(reservationUuid: string, guestUuid: string): string | null {
    try {
        return sessionStorage.getItem(storageKey(reservationUuid, guestUuid))
    } catch {
        return null
    }
}

export function setVerificationToken(reservationUuid: string, guestUuid: string, token: string): void {
    try {
        sessionStorage.setItem(storageKey(reservationUuid, guestUuid), token)
    } catch {
        // Storage unavailable (private mode, quota) — the guest will just be
        // asked for the OTP again on the next gated call, no crash.
    }
}

export function clearVerificationToken(reservationUuid: string, guestUuid: string): void {
    try {
        sessionStorage.removeItem(storageKey(reservationUuid, guestUuid))
    } catch {
        // no-op
    }
}
