"use client"

import { Reservation } from "@/types"
import { getColumns } from "./columns"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { reservationsService } from "../services/reservations-service"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ReservationsList() {
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            await reservationsService.delete(deleteTarget.id)
            setReservations((prev) => prev.filter((r) => r.id !== deleteTarget.id))
            toast.success("Reserva eliminada correctamente")
        } catch (error) {
            console.error("Failed to delete reservation:", error)
            notifyError(error, "Error al eliminar la reserva")
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    const columns = useMemo(
        () => getColumns({ onDelete: (reservation) => setDeleteTarget(reservation) }),
        []
    )

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

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar la reserva de <strong>{deleteTarget?.guestName}</strong>.
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
