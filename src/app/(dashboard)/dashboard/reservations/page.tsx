import { Metadata } from "next"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { ReservationsCalendar } from "@/features/reservations/components/ReservationsCalendar"
import ReservationsList from "@/features/reservations/components/ReservationsList"
import { ReservationDialog } from "@/features/reservations/components/ReservationDialog"

export const metadata: Metadata = {
    title: "Operaciones - Hit Guest",
    description: "Gestión detallada de reservas",
}

export default function ReservationsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                {/* h1: es el título de la pantalla (no había ninguno). */}
                <h1 className="text-3xl font-bold tracking-tight text-ink">Operaciones</h1>
                <ReservationDialog />
            </div>
            <Tabs defaultValue="list" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="list">Lista</TabsTrigger>
                    <TabsTrigger value="calendar">Calendario</TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="space-y-4">
                    <ReservationsList />
                </TabsContent>
                <TabsContent value="calendar" className="space-y-4">
                    <ReservationsCalendar />
                </TabsContent>
            </Tabs>
        </div>
    )
}
