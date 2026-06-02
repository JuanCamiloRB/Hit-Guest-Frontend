import { StatsCards } from "@/features/dashboard/components/StatsCards"
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader"
import ReservationsList from "@/features/reservations/components/ReservationsList"

export default function DashboardPage() {
    return (
        <div className="flex flex-col gap-8 p-6 lg:p-10">
            <DashboardHeader />

            <StatsCards />

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-800">
                        Lista de Reservas
                    </h2>
                </div>

                <ReservationsList />
            </div>
        </div>
    )
}
