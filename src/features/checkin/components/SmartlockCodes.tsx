"use client"

import { Key, DoorOpen, Building2 } from "lucide-react"
import type { SmartlockCode } from "@/features/checkin/types/checkin"

interface SmartlockCodesProps {
    codes: SmartlockCode[]
}

export function SmartlockCodes({ codes }: SmartlockCodesProps) {
    if (!codes || codes.length === 0) return null

    const getIcon = (type: string) => {
        switch (type) {
            case 'building_entrance': return <Building2 size={20} className="text-warning" />
            case 'unit_entrance': return <DoorOpen size={20} className="text-primary" />
            default: return <Key size={20} className="text-ink-3" />
        }
    }

    return (
        <div className="w-full max-w-sm space-y-3">
            <h3 className="font-bold text-ink text-left px-1 flex items-center gap-2">
                <Key size={18} className="text-ink-3" />
                Códigos de Acceso
            </h3>
            <div className="grid gap-3">
                {codes.map((code, idx) => (
                    <div key={idx} className="bg-white border border-rule rounded-xl p-4 shadow-sm flex items-center gap-4 text-left">
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
                    </div>
                ))}
            </div>
            <p className="text-xs text-ink-3 text-center mt-2 px-4">
                Estos códigos son válidos únicamente durante las fechas de tu estadía.
            </p>
        </div>
    )
}
