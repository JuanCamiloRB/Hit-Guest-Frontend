import { Metadata } from "next"
import { RegisterForm } from "@/features/auth/components/RegisterForm"
import { Building2 } from "lucide-react"

export const metadata: Metadata = {
    title: "Registro - Hit Guest",
    description: "Crea tu cuenta en Hit Guest",
}

export default function RegisterPage() {
    return (
        <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-zinc-900 p-10 text-white lg:flex justify-center items-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-violet-900" />
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                </div>

                <div className="relative z-20 flex flex-col items-center space-y-6 text-center">
                    <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-xl">
                        <Building2 className="h-10 w-10 text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">HIT Guest</h1>
                        <p className="text-lg text-blue-100 max-w-sm">
                            Comienza hoy a automatizar la gestión de tus propiedades.
                        </p>
                    </div>
                </div>
            </div>
            <div className="lg:p-8">
                <div className="absolute right-4 top-4 md:right-8 md:top-8">
                    <button className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 bg-muted/50 px-3 py-1 rounded-md">
                        Español (ES)
                    </button>
                </div>
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
                    <div className="flex flex-col space-y-2 text-center sm:text-left">
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Crea tu cuenta
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Regístrate como cliente y gestiona tus propiedades de forma profesional.
                        </p>
                    </div>
                    <RegisterForm />
                    <p className="px-8 text-center text-xs text-muted-foreground mt-8">
                        Powered by <span className="font-bold text-indigo-600">HIT Guest</span> © 2024
                    </p>
                </div>
            </div>
        </div>
    )
}
