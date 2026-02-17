import { Button } from "@/components/ui/button"
import { Filter, Plus } from "lucide-react"

export function DashboardHeader() {
    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 pb-6">
            <div>
                <div className="flex items-center text-sm text-muted-foreground mb-1">
                    <span>Inicio</span>
                    <span className="mx-2">›</span>
                    <span className="text-indigo-600 font-medium">Tablero de Operaciones</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tablero de Operaciones</h2>
                <p className="text-muted-foreground mt-1">
                    Gestión de reservas y automatizaciones activas
                </p>
            </div>
            <div className="flex items-center space-x-3">
                <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                </Button>
                <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Reserva
                </Button>
            </div>
        </div>
    )
}
