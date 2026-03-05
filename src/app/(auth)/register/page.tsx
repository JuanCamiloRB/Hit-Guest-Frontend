import { Metadata } from "next"
import { RegisterForm } from "@/features/auth/components/RegisterForm"
import { Logo } from "@/components/ui/Logo"

export const metadata: Metadata = {
    title: "Registro - Hit Guest",
    description: "Crea tu cuenta en Hit Guest",
}

export default function RegisterPage() {
    return (
        <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-primary p-10 text-white lg:flex justify-center items-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e42] via-[#222755] to-[#2a3068]" />
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                </div>

                <div className="relative z-20 flex flex-col items-center space-y-6 text-center">
                    <Logo variant="full" className="h-16 w-auto text-white" />
                    <div>
                        <p className="text-lg text-blue-100/80 max-w-sm font-secondary">
                            Comienza hoy a automatizar la gestión de tus propiedades de forma profesional.
                        </p>
                    </div>
                </div>
            </div>
            <div className="lg:p-8 flex items-center bg-background">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
                    <div className="flex flex-col space-y-2 text-center sm:text-left mb-4">
                        <h1 className="text-3xl font-sans font-bold tracking-tight text-primary">
                            Crea tu cuenta
                        </h1>
                        <p className="text-sm text-muted-foreground font-secondary">
                            Gestiona tus propiedades con infraestructura confiable.
                        </p>
                    </div>
                    <RegisterForm />
                    <p className="px-8 text-center text-[10px] text-muted-foreground mt-8 uppercase tracking-widest">
                        Powered by <span className="font-bold text-brand-blue">HIT Guest</span> © 2024
                    </p>
                </div>
            </div>
        </div>
    )
}
