import { describe, it, expect } from "vitest"
import { REQUIRED_AUTOMATION_SEED, AUTOMATION_STATUS } from "../types"

/**
 * Estas pruebas fijan un contrato con el BACKEND, no una preferencia de estilo.
 *
 * `POST /properties` responde 422 si la lista de automatizaciones falta o si no
 * incluye la verificación de identidad del titular y el contrato digital. Ese
 * seed ya se eliminó una vez —con buen motivo: mandaba TRA y SIRE, exclusivos de
 * Colombia, a propiedades de cualquier país— y la eliminación dejó la creación
 * de propiedades rota con un 422 que no se podía resolver desde la interfaz.
 *
 * Si alguien vuelve a quitarlo, que falle acá y no en producción.
 */
describe("REQUIRED_AUTOMATION_SEED", () => {
    it("incluye la verificación de identidad del huésped principal", () => {
        expect(REQUIRED_AUTOMATION_SEED).toContainEqual(
            expect.objectContaining({ providerSlug: "didit", guestType: "main_guest" }),
        )
    })

    it("incluye el contrato digital (TuFirma)", () => {
        expect(REQUIRED_AUTOMATION_SEED).toContainEqual(
            expect.objectContaining({ providerSlug: "tufirma", executionOrder: 3 }),
        )
    })

    it("no usa los órdenes 1 y 2 de las verificaciones para el contrato", () => {
        const contract = REQUIRED_AUTOMATION_SEED.find((item) => item.providerSlug === "tufirma")
        expect(contract?.executionOrder).toBeGreaterThan(2)
    })

    it("crea TODO inactivo: es configuración, no una automatización encendida", () => {
        // El punto que más importa: mandar estas filas NO le impone un contrato al
        // huésped. La automatización solo aplica cuando el PM la activa a mano en
        // su pestaña, que además solo existe una vez guardada la propiedad.
        for (const item of REQUIRED_AUTOMATION_SEED) {
            expect(item.statusProviderId).toBe(AUTOMATION_STATUS.INACTIVE)
        }
    })

    it("no siembra proveedores atados a un país", () => {
        // La razón por la que se eliminó el seed anterior: TRA y SIRE son de
        // Colombia y se estaban creando para propiedades de otros países. El mapa
        // país/proveedor del backend decide esos; acá solo va lo que exige validar.
        const countryBound = ["tra_colombia", "sire_colombia"]
        for (const item of REQUIRED_AUTOMATION_SEED) {
            expect(countryBound).not.toContain(item.providerSlug)
        }
    })

    it("se mantiene mínimo — solo lo que la validación exige", () => {
        // Cada fila de más es una automatización que el PM no pidió y que después
        // tiene que ir a desactivar a mano.
        expect(REQUIRED_AUTOMATION_SEED).toHaveLength(2)
    })

    it("no repite orden de ejecución", () => {
        const orders = REQUIRED_AUTOMATION_SEED.map((a) => a.executionOrder)
        expect(new Set(orders).size).toBe(orders.length)
    })
})
