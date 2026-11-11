"use client"

import { Key, DoorOpen, Building2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import type { SmartlockCode } from "@/features/checkin/types/checkin"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"

interface SmartlockCodesProps {
    codes: SmartlockCode[]
}

export function SmartlockCodes({ codes }: SmartlockCodesProps) {
    if (!codes || codes.length === 0) return null

    const getIcon = (type: string) => {
        switch (type) {
            case 'building_entrance': return <Icon icon={Building2} size="lg" className="text-warning" />
            case 'unit_entrance': return <Icon icon={DoorOpen} size="lg" className="text-primary" />
            default: return <Icon icon={Key} size="lg" className="text-ink-3" />
        }
    }

    return (
        <div className="w-full max-w-sm space-y-3">
            <Heading level={3} className="text-left px-1 flex items-center gap-2">
                <Icon icon={Key} size="lg" className="text-ink-3" />
                Códigos de Acceso
            </Heading>
            <div className="grid gap-3">
                {codes.map((code, idx) => (
                    <Surface className="p-4 flex items-center gap-4 text-left" key={idx}>
                        <div className="bg-sunk/50 p-3 rounded-xl border border-rule">
                            {getIcon(code.type)}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-ink-3 font-medium">{code.name}</p>
                            <p className="text-2xl font-bold text-ink tracking-widest mt-0.5">{code.code}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-semibold text-success bg-success-sunk px-2 py-1 rounded-xs">Activo</span>
                        </div>
                    </Surface>
                ))}
            </div>
            <p className="text-xs text-ink-3 text-center mt-2 px-4">
                Estos códigos son válidos únicamente durante las fechas de tu estadía.
            </p>
        </div>
    )
}
