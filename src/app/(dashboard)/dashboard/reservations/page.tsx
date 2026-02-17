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
    title: "Reservations - Hit Guest",
    description: "Manage your reservations",
}

export default function ReservationsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Reservations</h2>
                <ReservationDialog />
            </div>
            <Tabs defaultValue="list" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="list">List View</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar View</TabsTrigger>
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
