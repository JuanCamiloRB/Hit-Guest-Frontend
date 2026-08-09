import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useLocalStorage } from "./useLocalStorage"

describe("useLocalStorage", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it("persiste el valor y lo relee en el siguiente montaje", () => {
        const { result } = renderHook(() => useLocalStorage("k", { name: "" }))
        act(() => result.current[1]({ name: "Didier" }))

        const remontado = renderHook(() => useLocalStorage("k", { name: "" }))
        expect(remontado.result.current[0]).toEqual({ name: "Didier" })
    })

    it("mantiene en memoria las claves excluidas, pero NO las persiste", () => {
        const { result } = renderHook(() =>
            useLocalStorage(
                "k",
                { name: "", documentImage1: null as string | null },
                { excludeKeys: ["documentImage1"] },
            ),
        )

        act(() => result.current[1]({ name: "Didier", documentImage1: "data:image/jpeg;base64,AAAA" }))

        // En memoria sigue estando: el formulario puede validarla y mostrarla.
        expect(result.current[0].documentImage1).toBe("data:image/jpeg;base64,AAAA")
        // En disco no: por eso NO sobrevive a un cambio de ruta.
        expect(JSON.parse(localStorage.getItem("k")!)).toEqual({ name: "Didier" })
    })

    /**
     * Este es el recorrido real del TITULAR y documenta un defecto vigente, no
     * un comportamiento deseado.
     *
     * `GuestFormScreen` obliga a subir las fotos del documento y las guarda con
     * `excludeKeys: ["documentImage1", "documentImage2"]`. Después navega a
     * `/contract`, y `ContractScreen` vuelve a leer esa MISMA clave desde
     * localStorage para armar el payload de `/main/complete`. Como el hook
     * nunca las escribió, el titular sube dos fotos que jamás salen del
     * navegador.
     *
     * El acompañante no se ve afectado: `SecondaryGuestFormScreen` envía desde
     * su propio estado de React, sin pasar por disco.
     */
    it("el titular pierde las fotos del documento al cambiar de pantalla", () => {
        const CLAVE = "checkin-guest-form-abc123"

        // Pantalla 1 — GuestFormScreen: el huésped sube ambas caras.
        const { result } = renderHook(() =>
            useLocalStorage(
                CLAVE,
                { name: "", documentImage1: null as string | null, documentImage2: null as string | null },
                { excludeKeys: ["documentImage1", "documentImage2"] },
            ),
        )
        act(() =>
            result.current[1]({
                name: "Didier",
                documentImage1: "data:image/jpeg;base64,FRENTE",
                documentImage2: "data:image/jpeg;base64,REVERSO",
            }),
        )
        expect(result.current[0].documentImage1).not.toBeNull()

        // Pantalla 2 — ContractScreen lee la clave cruda para armar el payload.
        const form = JSON.parse(localStorage.getItem(CLAVE)!)

        expect(form.name).toBe("Didier")
        expect(form.documentImage1).toBeUndefined()
        expect(form.documentImage2).toBeUndefined()
    })
})
