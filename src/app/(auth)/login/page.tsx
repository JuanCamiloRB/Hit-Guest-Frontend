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
            {/* Navy de marca plano (sin degradado). La trama de puntos usa `currentColor`
                    (blanco del panel) en vez de un hex suelto. */}
            <div className="relative hidden h-full flex-col bg-brand-navy p-10 text-white lg:flex justify-center items-center overflow-hidden">
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                </div>

                <div className="relative z-20 flex flex-col items-center space-y-6 text-center">
                    <Logo variant="icon" className="h-16 w-auto transition-all hover:scale-105" isWhite={true} />
                    <div>
                        <p className="text-lg text-white/80 max-w-sm font-secondary">
                            Automatización inteligente para la gestión de hoteles y alquileres de renta corta.
                        </p>
                    </div>
                </div>
            </div>
            <div className="lg:p-8 flex items-center bg-background">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-100">
                    <LoginForm />
                    <p className="px-8 text-center text-xs text-ink-3 mt-8">
                        Powered by <span className="font-bold text-secondary">HIT Guest</span> ©{" "}
                        {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    )
}
