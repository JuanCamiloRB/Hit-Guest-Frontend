import { describe, it, expect } from "vitest"
import type { AutomationStatus } from "@/types"
import { getCheckinCellMeta } from "./automation-cell-meta"

const status = (checkin: AutomationStatus["checkin"]): AutomationStatus => ({
    link: "success",
    checkin,
    contract: "none",
    code: "none",
    tra: "none",
    sireIn: "none",
    sireOut: "none",
})

describe("getCheckinCellMeta", () => {
    it("cuenta cuántos huéspedes completaron el check-in", () => {
        expect(getCheckinCellMeta(status("pending"), { completed: 1, total: 3 })).toEqual({
            tone: "warning",
            label: "1 de 3 completados",
        })
    })

    // El punto del pedido: mientras falte alguien sigue en ámbar.
    it("se queda en ámbar aunque no haya empezado nadie", () => {
        expect(getCheckinCellMeta(status("pending"), { completed: 0, total: 3 })).toEqual({
            tone: "warning",
            label: "0 de 3 completados",
        })
    })

    it("pasa a verde solo cuando están todos", () => {
        expect(getCheckinCellMeta(status("pending"), { completed: 3, total: 3 })).toEqual({
            tone: "success",
            label: "3 de 3 completados",
        })
    })

    it("concuerda el singular con una reserva de un solo huésped", () => {
        expect(getCheckinCellMeta(status("pending"), { completed: 0, total: 1 }).label)
            .toBe("0 de 1 completado")
        expect(getCheckinCellMeta(status("success"), { completed: 1, total: 1 }).label)
            .toBe("1 de 1 completado")
    })

    // "No sabemos cuántos van" no es "no ha llegado ninguno".
    describe("sin conteo utilizable vuelve a la etiqueta binaria", () => {
        it("cuando el backend no reporta el conteo", () => {
            expect(getCheckinCellMeta(status("pending"), { completed: null, total: 3 })).toEqual({
                tone: "warning",
                label: "En proceso",
            })
        })

        it("cuando no se pasa progreso en absoluto", () => {
            expect(getCheckinCellMeta(status("success"))).toEqual({
                tone: "success",
                label: "Completo",
            })
        })

        it("cuando el total llega en cero", () => {
            expect(getCheckinCellMeta(status("pending"), { completed: 0, total: 0 }).label)
                .toBe("En proceso")
        })
    })

    // Sin automatización configurada no hay progreso que contar.
    it("respeta la ausencia y no inventa un progreso", () => {
        expect(getCheckinCellMeta(status("none"), { completed: 2, total: 3 })).toEqual({
            tone: "none",
            label: "—",
        })
    })

    it("no pinta un conteo imposible si el backend se pasa", () => {
        expect(getCheckinCellMeta(status("success"), { completed: 5, total: 2 })).toEqual({
            tone: "success",
            label: "2 de 2 completados",
        })
    })

    /**
     * Decisión de producto (Didier, 2026-08-21): la columna se llama CHECK-IN y
     * el tablero de operaciones cuenta check-ins TERMINADOS, así que la celda
     * habla únicamente de completados. Un huésped verificado que no completó
     * cuenta como cero — la verificación es otro eje del contrato (§2d) y se
     * consulta en el detalle de la reserva, no en la lista. (Esto retira la
     * variante del 2026-08-19 que mostraba «N de M verificados» mientras nadie
     * completaba.)
     */
    describe("la columna CHECK-IN cuenta check-ins completos, no verificaciones", () => {
        it("un huésped verificado sin completar sigue contando cero", () => {
            expect(getCheckinCellMeta(status("pending"), { completed: 0, total: 1 })).toEqual({
                tone: "warning",
                label: "0 de 1 completado",
            })
        })

        it("verde solo cuando completaron todos", () => {
            expect(getCheckinCellMeta(status("success"), { completed: 2, total: 2 })).toEqual({
                tone: "success",
                label: "2 de 2 completados",
            })
        })
    })
})
