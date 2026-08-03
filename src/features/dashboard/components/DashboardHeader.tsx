"use client"

import { useTranslation } from "@/hooks/useTranslation"
import { ReservationDialog } from "@/features/reservations/components/ReservationDialog"

export function DashboardHeader() {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-6">
            <div>
                <div className="flex items-center text-sm text-muted-foreground mb-1">
                    <span>{t('dashboard.home')}</span>
                    <span className="mx-2">›</span>
                    <span className="text-primary font-medium">{t('dashboard.title')}</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('dashboard.title')}</h2>
                <p className="text-muted-foreground mt-1">
                    {t('dashboard.description')}
                </p>
            </div>
            <div className="flex items-center space-x-3">
                <ReservationDialog />
            </div>
        </div>
    )
}
