import { Inbox, Mail } from "lucide-react"
import { siWhatsapp } from "simple-icons"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * Por dónde salió el link de check-in: WhatsApp (su marca, de Simple Icons, la
 * misma fuente que `ChannelLogo`), correo o mensaje en la OTA. Monocromo
 * (`currentColor`): dentro de una celda de estado toma el color del estado, no
 * el de la marca. Decorativo: el canal se nombra en el texto de al lado.
 */
export type DeliveryChannel = "whatsapp" | "email" | "ota"

export function DeliveryChannelIcon({ channel, className }: { channel: DeliveryChannel; className?: string }) {
    if (channel === "whatsapp") {
        return (
            <svg viewBox="0 0 24 24" data-slot="delivery-channel" data-channel="whatsapp" aria-hidden="true" className={cn("size-3.5 shrink-0 fill-current", className)}>
                <path d={siWhatsapp.path} />
            </svg>
        )
    }
    return (
        <span data-slot="delivery-channel" data-channel={channel} className="inline-flex">
            <Icon icon={channel === "email" ? Mail : Inbox} size="sm" className={className} />
        </span>
    )
}
