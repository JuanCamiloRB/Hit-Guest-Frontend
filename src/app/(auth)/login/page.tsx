import { Metadata } from "next"
import { LoginForm } from "@/features/auth/components/LoginForm"
import { Logo } from "@/components/ui/Logo"

export const metadata: Metadata = {
    title: "Login - Hit Guest",
    description: "Inicia sesión en tu cuenta",
}

export default function LoginPage() {
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
                            Automatización inteligente para la gestión de propiedades y experiencias hoteleras.
                        </p>
                    </div>
                </div>
            </div>
            <div className="lg:p-8 flex items-center bg-background">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
                    <LoginForm />
                    <p className="px-8 text-center text-[10px] text-muted-foreground mt-8 uppercase tracking-widest">
                        Powered by <span className="font-bold text-brand-blue">HIT Guest</span> © 2024
                    </p>
                </div>
            </div>
        </div>
    )
}
