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
            case 'building_entrance': return <Building2 size={20} className="text-amber-500" />
            case 'unit_entrance': return <DoorOpen size={20} className="text-brand-purple" />
            default: return <Key size={20} className="text-slate-400" />
        }
    }

    return (
        <div className="w-full max-w-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-left px-1 flex items-center gap-2">
                <Key size={18} className="text-slate-400" />
                Códigos de Acceso
            </h3>
            <div className="grid gap-3">
                {codes.map((code, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {getIcon(code.type)}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 font-medium">{code.name}</p>
                            <p className="text-2xl font-black text-slate-800 tracking-widest mt-0.5">{code.code}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded">Activo</span>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-2 px-4">
                Estos códigos son válidos únicamente durante las fechas de tu estadía.
            </p>
        </div>
    )
}
