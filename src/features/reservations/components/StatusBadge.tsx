import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, LogOut, FileText, Send, XCircle, Timer } from "lucide-react"

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
            className = "bg-[#d4f7e6] text-[#0bb37a] hover:bg-[#d4f7e6] border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-[#0bb37a] mr-2" />
            break
        case "PENDING":
            label = "Check-in Pendiente"
            className = "bg-[#fff3c4] text-[#ffb000] hover:bg-[#fff3c4] border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-[#ffb000] mr-2" />
            break
        case "PENDING_CONTRACT":
            label = "Pendiente Contrato"
            className = "bg-[#fff3c4] text-[#ffb000] hover:bg-[#fff3c4] border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-[#ffb000] mr-2" />
            break
        case "CONFIRMED":
            label = "Completado"
            className = "bg-[#d4f7e6] text-[#0bb37a] hover:bg-[#d4f7e6] border-transparent"
            icon = <Check className="h-3 w-3 mr-1.5" />
            break
        case "NO_STARTED":
            label = "No Iniciado"
            className = "bg-[#f1f5f9] text-[#64748b] hover:bg-[#f1f5f9] border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-[#94a3b8] mr-2" />
            break
        case "CHECKED_OUT":
            label = "Salida (Check-out)"
            className = "bg-[#d4f7e6] text-[#0bb37a] hover:bg-[#d4f7e6] border-transparent"
            icon = <LogOut className="h-3 w-3 mr-1.5" />
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
