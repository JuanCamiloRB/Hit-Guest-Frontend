"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SecondaryGateStatus } from "../types/checkin"
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react"

interface SecondaryGateScreenProps {
    status: SecondaryGateStatus
    basePath: string
}

export function SecondaryGateScreen({ status, basePath }: SecondaryGateScreenProps) {
    const router = useRouter()
    const [isRefreshing, setIsRefreshing] = useState(false)

    useEffect(() => {
        // Si el titular ya completó, redirigir a identity
        if (status.mainGuestCompleted) {
            router.push(`${basePath}/identify`)
        }
    }, [status.mainGuestCompleted, basePath, router])

    const handleRefresh = () => {
        setIsRefreshing(true)
        window.location.reload()
    }

    if (status.mainGuestCompleted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 animate-in fade-in duration-500">
                <CheckCircle2 className="h-12 w-12 text-green-500 animate-pulse" />
                <h1 className="text-xl font-bold text-slate-900">Redirigiendo...</h1>
                <p className="text-slate-500">El titular ya completó su registro, preparándote para comenzar.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-amber-100 p-4 rounded-full mb-6">
                <Clock className="h-10 w-10 text-amber-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Registro en espera</h1>
            
            <p className="text-slate-600 mb-6 max-w-sm">
                Hola. El titular de la reserva, <strong>{status.mainGuestName || "tu anfitrión"}</strong>, aún no ha completado su proceso de check-in obligatorio.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 w-full max-w-sm mb-8 flex items-start gap-3 text-left">
                <AlertCircle className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                    <span className="font-semibold block mb-1">¿Qué debes hacer?</span>
                    Pídele al titular que finalice su registro. Una vez lo haga, esta página te permitirá ingresar tus datos.
                </div>
            </div>

            <Button 
                onClick={handleRefresh}
                className="w-full max-w-xs h-12 bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl font-semibold shadow-lg shadow-brand-navy/20"
                disabled={isRefreshing}
            >
                {isRefreshing ? "Comprobando..." : "Ya lo completó, recargar página"}
            </Button>
        </div>
    )
}
