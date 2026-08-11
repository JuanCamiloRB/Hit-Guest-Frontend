import { describe, it, expect } from "vitest"
import { INITIAL_AUTOMATION_SEED, AUTOMATION_STATUS } from "../types"

/**
 * Estas pruebas fijan un contrato con el BACKEND, no una preferencia de estilo.
 *
 * Fija el contrato nuevo de creación: identidad disponible pero apagada, y
 * ningún contrato implícito. El contrato solo nace por una decisión explícita.
 */
describe("INITIAL_AUTOMATION_SEED", () => {
    it("incluye la verificación de identidad del huésped principal", () => {
        expect(INITIAL_AUTOMATION_SEED).toContainEqual(
            expect.objectContaining({ providerSlug: "didit", guestType: "main_guest" }),
        )
    })

    it("no crea un contrato digital implícito", () => {
        expect(INITIAL_AUTOMATION_SEED).not.toContainEqual(
            expect.objectContaining({ providerSlug: "tufirma" }),
        )
    })

    it("crea TODO inactivo: es configuración, no una automatización encendida", () => {
        // La fila técnica no debe imponer verificación al huésped: solo aplica
        // cuando el PM la activa expresamente después de guardar la propiedad.
        for (const item of INITIAL_AUTOMATION_SEED) {
            expect(item.statusProviderId).toBe(AUTOMATION_STATUS.INACTIVE)
        }
    })

    it("no siembra proveedores atados a un país", () => {
        // La razón por la que se eliminó el seed anterior: TRA y SIRE son de
        // Colombia y se estaban creando para propiedades de otros países. El mapa
        // país/proveedor del backend decide esos; acá solo va lo que exige validar.
        const countryBound = ["tra_colombia", "sire_colombia"]
        for (const item of INITIAL_AUTOMATION_SEED) {
            expect(countryBound).not.toContain(item.providerSlug)
        }
    })

    it("se mantiene mínimo — solo lo que la validación exige", () => {
        // Cada fila de más es una automatización que el PM no pidió y que después
        // tiene que ir a desactivar a mano.
        expect(INITIAL_AUTOMATION_SEED).toHaveLength(1)
    })

    it("no repite orden de ejecución", () => {
        const orders = INITIAL_AUTOMATION_SEED.map((a) => a.executionOrder)
        expect(new Set(orders).size).toBe(orders.length)
    })
})
