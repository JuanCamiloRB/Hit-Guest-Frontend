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
import { Page, PageHeader } from "@/components/ui/page"

export const metadata: Metadata = {
    title: "Operaciones - Hit Guest",
    description: "Gestión detallada de reservas",
}

export default function ReservationsPage() {
    return (
        <Page>
            <PageHeader title="Operaciones" actions={<ReservationDialog />} />
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
        </Page>
    )
}
