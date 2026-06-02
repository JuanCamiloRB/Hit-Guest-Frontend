"use client"

import { Reservation } from "@/types"
import { columns } from "./columns"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { reservationsService } from "../services/reservations-service"

export default function ReservationsList() {
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadReservations = async () => {
            try {
                const data = await reservationsService.list()
                setReservations(data)
            } catch (error) {
                console.error("Failed to fetch reservations:", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadReservations()

        const handleReservationCreated = () => {
            setIsLoading(true)
            loadReservations()
        }

        window.addEventListener("reservationCreated", handleReservationCreated)
        return () => window.removeEventListener("reservationCreated", handleReservationCreated)
    }, [])

    if (isLoading) {
        return (
            <div className="flex h-[400px] w-full items-center justify-center rounded-md border border-slate-200 border-dashed">
                <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-purple" />
                    <span className="text-sm font-medium">Cargando reservaciones...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <DataTable columns={columns} data={reservations} />
        </div>
    )
}
