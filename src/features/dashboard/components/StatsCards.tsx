import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, LogOut, MoreHorizontal, Wallet } from "lucide-react"

export function StatsCards() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-400 shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-emerald-400" />
                            CHECK-INS HOY
                        </span>
                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold">4</div>
                </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-200 shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <LogOut className="h-4 w-4 text-slate-400" />
                            CHECK-OUTS HOY
                        </span>
                    </div>
                    <div className="text-2xl font-bold">2</div>
                </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-400 shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <MoreHorizontal className="h-4 w-4 text-amber-400" />
                            PENDIENTES
                        </span>
                        <div className="h-2 w-2 rounded-full bg-amber-400" />
                    </div>
                    <div className="text-2xl font-bold">8</div>
                </CardContent>
            </Card>
            <Card className="border-l-4 border-l-indigo-600 shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-indigo-600" />
                            INGRESOS (FEB)
                        </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">$14.5M</span>
                        <span className="text-xs text-muted-foreground font-semibold">COP</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
