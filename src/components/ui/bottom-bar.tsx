import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * La barra fija al pie del portal del huésped (DS-8b, 2026-11-13): el lugar de
 * la acción principal de cada paso («Continuar», «Firmar», «Volver al
 * inicio»). Estaba copiada 13 veces, con tres variantes de borde, fondo y
 * capa (`border-rule/50` y `/70`, vidrio y sólido, `z-10` y `z-40`).
 *
 * Vidrio sobre el contenido (`bg-white/80` + desenfoque) con el divisor del
 * sistema. El contenido copia EXACTAMENTE el `<main>` del portal (`max-w-lg` +
 * `px-4`): el relleno horizontal va en el contenido, no en la barra. Con el
 * relleno afuera la caja del contenido medía 512 px contra los 480 px de las
 * tarjetas, y desde 544 px de ancho el botón sobresalía 16 px por lado (11 de
 * las 13 barras tenían ese error; la de `WelcomeScreen` no). La pantalla
 * reserva su propio espacio al pie (`pb-24`) para que el último campo no quede
 * debajo. Sin `env(safe-area-inset-bottom)`: la app no fija `viewport-fit=cover`.
 *
 * `className` es el layout DEL CONTENIDO (`flex gap-3`, `flex flex-col gap-2`),
 * no de la barra.
 */
function BottomBar({ className, children, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="bottom-bar"
            className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t border-rule/50 bg-white/80 py-4 backdrop-blur-md"
            {...props}
        >
            <div data-slot="bottom-bar-content" className={cn("w-full max-w-lg px-4", className)}>
                {children}
            </div>
        </div>
    )
}

export { BottomBar }
