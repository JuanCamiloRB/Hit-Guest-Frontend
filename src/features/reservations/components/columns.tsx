"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreVertical, Calendar, Home, Briefcase, Globe } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Reservation } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { StatusBadge } from "./StatusBadge"

export const columns: ColumnDef<Reservation>[] = [
    {
        accessorKey: "guestName",
        header: "HUÉSPED",
        cell: ({ row }) => {
            const name = row.getValue("guestName") as string
            const initials = name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)

            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 bg-purple-100 text-purple-600">
                        {/* Placeholder for avatar image if available in future */}
                        <AvatarFallback className="bg-purple-100 text-purple-600 font-medium">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-sm text-slate-900">{name}</span>
                        {/* Could add email or phone if available in data */}
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "propertyName",
        header: "ALOJAMIENTO",
        cell: ({ row }) => {
            const reservation = row.original
            return (
                <div className="flex flex-col">
                    <span className="text-sm text-slate-600">
                        {reservation.propertyName}
                    </span>
                    {/* Assuming unitName is distinct or important */}
                    {reservation.unitName !== reservation.propertyName && (
                        <span className="text-xs text-muted-foreground">{reservation.unitName}</span>
                    )}
                </div>
            )
        }
    },
    {
        accessorKey: "checkIn",
        header: "FECHAS",
        cell: ({ row }) => {
            const checkIn = new Date(row.original.checkIn)
            const checkOut = new Date(row.original.checkOut)
            const nights = row.original.nights

            return (
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-900">
                        {format(checkIn, "d MMM", { locale: es })} – {format(checkOut, "d MMM", { locale: es })}
                    </span>
                    <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                        {nights} noches
                    </span>
                </div>
            )
        }
    },
    {
        accessorKey: "source",
        header: "ORIGEN",
        cell: ({ row }) => {
            const source = row.original.source
            let icon = <Globe className="h-4 w-4 text-slate-500" />
            let colorClass = "text-slate-600"

            if (source === "Airbnb") {
                icon = <Home className="h-4 w-4 text-rose-500" /> // Using Home as Airbnb proxy
                colorClass = "text-slate-700"
            } else if (source === "Booking") {
                icon = <Briefcase className="h-4 w-4 text-blue-900" />
                colorClass = "text-slate-700"
            }

            return (
                <div className="flex items-center gap-2">
                    {icon}
                    <span className={colorClass}>{source}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "status",
        header: "ESTADO",
        cell: ({ row }) => {
            return <StatusBadge status={row.getValue("status")} />
        },
    },
    {
        id: "actions",
        header: "ACCIONES",
        cell: ({ row }) => {
            const payment = row.original

            return (
                <div className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400">
                                <span className="sr-only">Open menu</span>
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText(payment.id)}
                            >
                                Copiar ID
                            </DropdownMenuItem>
                            <DropdownMenuItem>Ver detalles</DropdownMenuItem>
                            <DropdownMenuItem>Mensaje</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        },
    },
]

