"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"

interface UseFormSecurityOptions {
    minTime?: number // Minimum time in ms to fill form (default 1000ms)
    maxRequests?: number // Max requests per window
    windowMs?: number // Window size in ms (default 1 minute)
    formId: string // Unique ID for rate limiting
}

export function useFormSecurity({
    minTime = 1000,
    maxRequests = 3,
    windowMs = 60000,
    formId,
}: UseFormSecurityOptions) {
    const [honeypotValue, setHoneypotValue] = useState("")
    const mountTime = useRef<number>(0)

    useEffect(() => {
        mountTime.current = Date.now()
    }, [])

    const validateSubmission = (): boolean => {
        const now = Date.now()

        // 1. Honeypot Check
        if (honeypotValue !== "") {
            console.warn("Security: Honeypot filled")
            return false // Silent fail for bots
        }

        // 2. Time Verification (too fast?)
        if (now - mountTime.current < minTime) {
            console.warn("Security: Submission too fast")
            return false // Silent fail
        }

        // 3. Rate Limiting (Client-side)
        const storageKey = `rate_limit_${formId}`
        try {
            const record = JSON.parse(localStorage.getItem(storageKey) || '{"count": 0, "timestamp": 0}')

            // Reset if window passed
            if (now - record.timestamp > windowMs) {
                localStorage.setItem(storageKey, JSON.stringify({ count: 1, timestamp: now }))
                return true
            }

            // Check limit
            if (record.count >= maxRequests) {
                toast.error("Demasiados intentos. Por favor espera un momento.")
                return false
            }

            // Increment
            localStorage.setItem(storageKey, JSON.stringify({
                count: record.count + 1,
                timestamp: record.timestamp
            }))
        } catch (e) {
            // If localStorage fails, proceed (don't block user)
            console.error("Rate limit check failed", e)
        }

        return true
    }

    return {
        honeypotProps: {
            value: honeypotValue,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHoneypotValue(e.target.value),
        },
        validateSubmission,
    }
}
