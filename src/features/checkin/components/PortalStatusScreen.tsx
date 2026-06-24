import { XCircle, Trash2 } from "lucide-react"

interface PortalStatusScreenProps {
    status: "cancelled" | "deleted"
    message?: string
}

const STATUS_CONTENT: Record<
    PortalStatusScreenProps["status"],
    { icon: typeof XCircle; title: string; defaultMessage: string; accent: string }
> = {
    cancelled: {
        icon: XCircle,
        title: "Reserva cancelada",
        defaultMessage:
            "Esta reserva fue cancelada y ya no está disponible para el check-in.",
        accent: "text-amber-500 bg-amber-50",
    },
    deleted: {
        icon: Trash2,
        title: "Reserva no disponible",
        defaultMessage: "Esta reserva ya no existe.",
        accent: "text-red-500 bg-red-50",
    },
}

export function PortalStatusScreen({ status, message }: PortalStatusScreenProps) {
    const content = STATUS_CONTENT[status]
    const Icon = content.icon

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-in fade-in duration-500">
            <div className={`rounded-full p-4 mb-5 ${content.accent}`}>
                <Icon size={40} strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">{content.title}</h1>
            <p className="text-slate-500 max-w-md leading-relaxed">
                {message || content.defaultMessage}
            </p>
            <p className="text-xs text-slate-400 mt-8">
                Si crees que esto es un error, contacta a tu anfitrión.
            </p>
        </div>
    )
}
