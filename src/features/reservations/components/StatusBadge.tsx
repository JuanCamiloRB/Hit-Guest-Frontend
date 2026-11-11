import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, LogOut, FileText, Send, XCircle, Timer } from "lucide-react"
import { Icon } from "@/components/ui/icon"

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
            className = "bg-success-sunk text-success hover:bg-success-sunk border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-success mr-2" />
            break
        case "PENDING":
            label = "Check-in Pendiente"
            className = "bg-warning-sunk text-warning hover:bg-warning-sunk border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-warning mr-2" />
            break
        case "PENDING_CONTRACT":
            label = "Pendiente Contrato"
            className = "bg-warning-sunk text-warning hover:bg-warning-sunk border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-warning mr-2" />
            break
        case "CONFIRMED":
            label = "Completado"
            className = "bg-success-sunk text-success hover:bg-success-sunk border-transparent"
            icon = <Icon icon={Check} size="xs" className="mr-1.5" />
            break
        case "NO_STARTED":
            label = "No Iniciado"
            className = "bg-sunk text-ink-3 hover:bg-sunk border-transparent"
            icon = <div className="h-1.5 w-1.5 rounded-full bg-ink-4 mr-2" />
            break
        case "CHECKED_OUT":
            label = "Salida (Check-out)"
            className = "bg-success-sunk text-success hover:bg-success-sunk border-transparent"
            icon = <Icon icon={LogOut} size="xs" className="mr-1.5" />
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
