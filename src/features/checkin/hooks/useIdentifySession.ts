"use client"

import { useCallback } from "react"
import type { IdentifyResponse, IdentifySessionData, VerificationDirective, FormSchema } from "../types/checkin"

const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function getStorageKey(reservationUuid: string, guestUuid?: string): string {
    if (guestUuid) return `checkin-identify-${reservationUuid}-${guestUuid}`
    return `checkin-identify-${reservationUuid}`
}

/**
 * Hook to persist and retrieve the /identify response across page navigations.
 * Stores guest UUID, verification directive, and formSchema in localStorage.
 * Keys are per-guest so main and secondary sessions don't overwrite each other.
 */
export function useIdentifySession(reservationUuid: string) {

    const save = useCallback((response: IdentifyResponse, identificationTypeId?: number) => {
        const data: IdentifySessionData = {
            guestUuid: response.guest.uuid,
            guestName: response.guest.name,
            guestLastname: response.guest.lastname,
            isMainGuest: response.reservationGuest.isMainGuest,
            isCheckinCompleted: response.reservationGuest.isCheckinCompleted,
            verification: response.verification,
            formSchema: response.formSchema,
            timestamp: Date.now(),
            identificationTypeId,
        }
        try {
            const key = getStorageKey(reservationUuid, response.guest.uuid)
            localStorage.setItem(key, JSON.stringify(data))
            // Also store under reservation-only key for backwards compat (VerifyScreen loads before knowing guestUuid)
            localStorage.setItem(getStorageKey(reservationUuid), JSON.stringify(data))
        } catch (e) {
            console.error("Failed to save identify session:", e)
        }
    }, [reservationUuid])

    const load = useCallback((guestUuid?: string): IdentifySessionData | null => {
        try {
            const key = getStorageKey(reservationUuid, guestUuid)
            let raw = localStorage.getItem(key)
            // Fallback to reservation-only key if guest-specific not found
            if (!raw && guestUuid) raw = localStorage.getItem(getStorageKey(reservationUuid))
            if (!raw) return null
            const data: IdentifySessionData = JSON.parse(raw)
            if (Date.now() - data.timestamp > SESSION_TTL_MS) {
                localStorage.removeItem(key)
                return null
            }
            return data
        } catch (e) {
            return null
        }
    }, [reservationUuid])

    const clear = useCallback((guestUuid?: string) => {
        try {
            localStorage.removeItem(getStorageKey(reservationUuid, guestUuid))
            localStorage.removeItem(getStorageKey(reservationUuid))
        } catch (e) {}
    }, [reservationUuid])

    const getGuestUuid = useCallback((): string | null => {
        return load()?.guestUuid ?? null
    }, [load])

    const getVerification = useCallback((): VerificationDirective | null => {
        return load()?.verification ?? null
    }, [load])

    const getFormSchema = useCallback((): FormSchema | null => {
        return load()?.formSchema ?? null
    }, [load])

    return { save, load, clear, getGuestUuid, getVerification, getFormSchema }
}
