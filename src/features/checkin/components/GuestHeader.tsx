"use client"

import { Logo } from "@/components/ui/Logo"

export function GuestHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-brand-navy backdrop-blur supports-[backdrop-filter]:bg-brand-navy/90">
            <div className="container flex h-14 items-center max-w-lg mx-auto px-4 justify-center">
                <Logo variant="full" className="h-6 w-auto" isWhite={true} />
            </div>
        </header>
    )
}
