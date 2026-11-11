"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SecondaryGateStatus } from "../types/checkin"
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Heading } from "@/components/ui/heading"

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
                <Icon icon={CheckCircle2} size="4xl" className="text-success animate-pulse" />
                <Heading level={1} size="title">Redirigiendo...</Heading>
                <p className="text-ink-3">El titular ya completó su registro, preparándote para comenzar.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-warning-sunk p-4 rounded-full mb-6">
                <Icon icon={Clock} size="3xl" className="text-warning" />
            </div>
            
            <Heading level={1} className="mb-4">Registro en espera</Heading>
            
            <p className="text-ink-2 mb-6 max-w-sm">
                Hola. El titular de la reserva, <strong>{status.mainGuestName || "tu anfitrión"}</strong>, aún no ha completado su proceso de check-in obligatorio.
            </p>
            
            <div className="bg-sunk/50 border border-rule rounded-xl p-5 w-full max-w-sm mb-8 flex items-start gap-3 text-left">
                <Icon icon={AlertCircle} size="lg" className="text-primary mt-0.5" />
                <div className="text-sm text-ink-2">
                    <span className="font-semibold block mb-1">¿Qué debes hacer?</span>
                    Pídele al titular que finalice su registro. Una vez lo haga, esta página te permitirá ingresar tus datos.
                </div>
            </div>

            <Button size="xl"
                onClick={handleRefresh}
                className="w-full max-w-xs"
                disabled={isRefreshing}
            >
                {isRefreshing ? "Comprobando..." : "Ya lo completó, recargar página"}
            </Button>
        </div>
    )
}
