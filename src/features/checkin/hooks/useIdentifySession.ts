"use client"

import { useCallback } from "react"
import type { IdentifyResponse, IdentifySessionData, VerificationDirective, FormSchema } from "../types/checkin"

const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function getStorageKey(reservationUuid: string): string {
    return `checkin-identify-${reservationUuid}`
}

/**
 * Hook to persist and retrieve the /identify response across page navigations.
 * Stores guest UUID, verification directive, and formSchema in localStorage.
 */
export function useIdentifySession(reservationUuid: string) {

    const save = useCallback((response: IdentifyResponse) => {
        const data: IdentifySessionData = {
            guestUuid: response.guest.uuid,
            guestName: response.guest.name,
            guestLastname: response.guest.lastname,
            isMainGuest: response.reservationGuest.isMainGuest,
            isCheckinCompleted: response.reservationGuest.isCheckinCompleted,
            verification: response.verification,
            formSchema: response.formSchema,
            timestamp: Date.now(),
        }
        try {
            localStorage.setItem(getStorageKey(reservationUuid), JSON.stringify(data))
        } catch (e) {
            console.error("Failed to save identify session:", e)
        }
    }, [reservationUuid])

    const load = useCallback((): IdentifySessionData | null => {
        try {
            const raw = localStorage.getItem(getStorageKey(reservationUuid))
            if (!raw) return null
            const data: IdentifySessionData = JSON.parse(raw)
            // Invalidate if too old
            if (Date.now() - data.timestamp > SESSION_TTL_MS) {
                localStorage.removeItem(getStorageKey(reservationUuid))
                return null
            }
            return data
        } catch (e) {
            return null
        }
    }, [reservationUuid])

    const clear = useCallback(() => {
        try {
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
