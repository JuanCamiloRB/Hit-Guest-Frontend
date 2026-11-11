import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * El `<input type="file">` del sistema: oculto, porque la interfaz visible es
 * un Button o una zona de carga que lo abre (`ref.current.click()`) o un
 * `Label` que lo envuelve. Conserva el nombre accesible que reciba.
 */
function FileInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
    return <input type="file" data-slot="file-input" className={cn("sr-only", className)} {...props} />
}

export { FileInput }
