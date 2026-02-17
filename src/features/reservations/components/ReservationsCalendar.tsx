"use client"

import { useState } from "react"
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isWithinInterval
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mockReservations } from "../data/mock-reservations"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function ReservationsCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date())

    const startDate = startOfWeek(startOfMonth(currentMonth))
    const endDate = endOfWeek(endOfMonth(currentMonth))

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
    const today = () => setCurrentMonth(new Date())

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                    {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={today}>Today</Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="bg-background p-2 text-center text-sm font-semibold">
                        {day}
                    </div>
                ))}

                {days.map((day, dayIdx) => {
                    const dayReservations = mockReservations.filter(res =>
                        isWithinInterval(day, { start: res.checkIn, end: res.checkOut })
                    )

                    return (
                        <div
                            key={day.toString()}
                            className={cn(
                                "bg-background min-h-[100px] p-2 flex flex-col space-y-1 hover:bg-muted/50 transition-colors",
                                !isSameMonth(day, currentMonth) && "text-muted-foreground bg-muted/20"
                            )}
                        >
                            <span className={cn(
                                "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                isSameDay(day, new Date()) && "bg-primary text-primary-foreground"
                            )}>
                                {format(day, "d")}
                            </span>

                            {dayReservations.map(res => (
                                <div
                                    key={res.id}
                                    className="text-xs truncate bg-primary/10 text-primary px-1 py-0.5 rounded cursor-pointer hover:bg-primary/20"
                                    title={`${res.guestName} (${res.status})`}
                                >
                                    {res.guestName}
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
