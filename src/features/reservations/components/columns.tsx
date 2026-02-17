"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Calendar, Home } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Reservation } from "@/types"
import { format } from "date-fns"

export const columns: ColumnDef<Reservation>[] = [
    {
        accessorKey: "guestName",
        header: "Guest",
        cell: ({ row }) => {
            return (
                <div className="font-medium">{row.getValue("guestName")}</div>
            )
        }
    },
    {
        accessorKey: "propertyName",
        header: "Property / Unit",
        cell: ({ row }) => {
            const reservation = row.original
            return (
                <div className="flex flex-col text-sm">
                    <span className="font-medium flex items-center">
                        <Home className="mr-1 h-3 w-3 text-muted-foreground" />
                        {reservation.propertyName}
                    </span>
                    <span className="text-muted-foreground text-xs pl-4">{reservation.unitName}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "checkIn",
        header: "Dates",
        cell: ({ row }) => {
            const checkIn = new Date(row.original.checkIn)
            const checkOut = new Date(row.original.checkOut)
            return (
                <div className="flex flex-col text-sm">
                    <span className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3 text-green-600" />
                        {format(checkIn, "MMM dd, yyyy")}
                    </span>
                    <span className="flex items-center">
                        <Calendar className="mr-1 h-3 w-3 text-red-600" />
                        {format(checkOut, "MMM dd, yyyy")}
                    </span>
                </div>
            )
        }
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            let variant: "default" | "secondary" | "destructive" | "outline" = "default"
            if (status === "CONFIRMED") variant = "default" // green? default is black.
            if (status === "PENDING") variant = "secondary"
            if (status === "CANCELLED") variant = "destructive"
            if (status === "CHECKED_IN") variant = "outline" // maybe primary color

            return <Badge variant={variant}>{status}</Badge>
        },
    },
    {
        accessorKey: "totalPrice",
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalPrice"))
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(amount)

            return <div className="text-right font-medium">{formatted}</div>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const payment = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(payment.id)}
                        >
                            Copy reservation ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        <DropdownMenuItem>Message Guest</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Cancel Reservation</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
