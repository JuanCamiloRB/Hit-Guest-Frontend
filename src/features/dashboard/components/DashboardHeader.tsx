"use client"

import { useTranslation } from "@/hooks/useTranslation"
import { ReservationDialog } from "@/features/reservations/components/ReservationDialog"

export function DashboardHeader() {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
                <div className="mb-1 flex items-center text-[13px] text-ink-3">
                    <span>{t('dashboard.home')}</span>
                    <span className="mx-2">›</span>
                    <span className="font-medium text-ink-2">{t('dashboard.title')}</span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t('dashboard.title')}</h1>
                <p className="mt-1 text-sm text-ink-3">
                    {t('dashboard.description')}
                </p>
            </div>
            <div className="flex items-center gap-3">
                <ReservationDialog />
            </div>
        </div>
    )
}
