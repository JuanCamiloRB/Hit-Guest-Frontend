"use client"

import { useTranslation } from "@/hooks/useTranslation"
import { ReservationDialog } from "@/features/reservations/components/ReservationDialog"
import { PageBreadcrumb, PageHeader } from "@/components/ui/page"

export function DashboardHeader() {
    const { t } = useTranslation()

    return (
        <PageHeader
            eyebrow={<PageBreadcrumb items={[{ label: t("dashboard.home"), href: "/dashboard" }, { label: t("dashboard.title") }]} />}
            title={t("dashboard.title")}
            description={t("dashboard.description")}
            actions={<ReservationDialog />}
        />
    )
}
