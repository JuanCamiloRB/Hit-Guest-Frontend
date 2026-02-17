import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, Clock, FileText, Send, XCircle, LogOut, Timer } from "lucide-react"

interface StatusBadgeProps {
    status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
    let label = status
    let variant = "default"
    let className = ""
    let icon = null

    switch (status) {
        case "LINK_SENT":
            label = "Link Enviado"
            className = "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2" />
            break
        case "PENDING":
            label = "Check-in Pendiente" // Or just "Pendiente" depending on context, using design text
            className = "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mr-2" />
            break
        case "PENDING_CONTRACT":
            label = "Pendiente Contrato"
            className = "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-2" />
            break
        case "CONFIRMED":
            label = "Completado"
            className = "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
            icon = <Check className="h-3 w-3 mr-1" />
            break
        case "NO_STARTED":
            label = "No Iniciado"
            className = "bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-2" />
            break
        case "CHECKED_OUT":
            label = "Salida (Check-out)"
            className = "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100"
            icon = <LogOut className="h-3 w-3 mr-1" />
            break
        default:
            label = status
            break
    }

    return (
        <Badge variant="outline" className={cn("font-normal px-2.5 py-0.5 border", className)}>
            {icon}
            {label}
        </Badge>
    )
}
