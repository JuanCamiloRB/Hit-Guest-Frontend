"use client"

import { Button } from "@/components/ui/button"
import { Filter, Plus } from "lucide-react"
import { useTranslation } from "@/hooks/useTranslation"
import { NewReservationDialog } from "@/features/reservations/components/NewReservationDialog"
import { useState } from "react"

export function DashboardHeader() {
    const { t } = useTranslation()
    const [isReservationOpen, setIsReservationOpen] = useState(false)

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-6">
            <div>
                <div className="flex items-center text-sm text-muted-foreground mb-1">
                    <span>{t('dashboard.home')}</span>
                    <span className="mx-2">›</span>
                    <span className="text-indigo-600 font-medium">{t('dashboard.title')}</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('dashboard.title')}</h2>
                <p className="text-muted-foreground mt-1">
                    {t('dashboard.description')}
                </p>
            </div>
            <div className="flex items-center space-x-3">
                <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    {t('dashboard.filters')}
                </Button>
                <Button 
                    className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2"
                    onClick={() => setIsReservationOpen(true)}
                >
                    <Plus className="h-4 w-4" />
                    {t('dashboard.newReservation')}
                </Button>
            </div>
            
            <NewReservationDialog 
                open={isReservationOpen} 
                onOpenChange={setIsReservationOpen} 
            />
        </div>
    )
}
