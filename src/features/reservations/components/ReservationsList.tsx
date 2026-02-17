"use client"

import { Reservation } from "@/types"
import { columns } from "./columns"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

// Mock data
import { mockReservations } from "../data/mock-reservations"

// ... 

export default function ReservationsList() {
    return (
        <div className="space-y-4">
            <DataTable columns={columns} data={mockReservations} filterColumn="guestName" />
        </div>
    )
}
