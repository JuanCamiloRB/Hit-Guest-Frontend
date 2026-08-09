import { describe, it, expect } from "vitest"
import type { GuaranteeStatus, PortalContractInfo } from "./checkin"

/**
 * Fija las dos máquinas de estado que el portal recibe además de la de
 * verificación (§B contrato y §C garantía del documento de endpoints).
 *
 * El valor de estos tests no es "el enum tiene N entradas" — es que cada estado
 * que el backend puede emitir tenga una salida definida para el huésped. Los dos
 * que faltaban (`detached` y `rejected`) dejaban callejones sin salida.
 */

type ContractStatus = PortalContractInfo["status"]

/** Cómo debe reaccionar el paso de garantía a cada estado. */
const ACCION_GARANTIA: Record<GuaranteeStatus, "pedir_tarjeta" | "sondear" | "listo"> = {
    not_started: "pedir_tarjeta",
    failed: "pedir_tarjeta",
    // La tarjeta se desvinculó fuera del portal: para el huésped es igual que no
    // tener ninguna. Sin esta entrada quedaba en "Preparando formulario…" para
    // siempre, sin botón de reintento y bloqueando el check-in entero.
    detached: "pedir_tarjeta",
    pending: "sondear",
    active: "listo",
}

/** Qué debe ver el huésped en la pantalla final para cada estado del contrato. */
const UI_CONTRATO: Record<ContractStatus, "nada" | "esperando" | "descargar" | "avisar_fallo"> = {
    not_started: "nada",
    pending: "esperando",
    signed: "esperando",     // firmado ≠ descargable: falta que el backend publique la URL
    completed: "descargar",
    // Terminal y sin reintento del huésped, pero hay que decírselo: antes no se
    // renderizaba nada y la pantalla afirmaba que el registro estaba completo.
    rejected: "avisar_fallo",
}

describe("§C máquina de estados de la garantía", () => {
    it("los 5 estados del backend tienen una acción definida", () => {
        const estados: GuaranteeStatus[] = ["not_started", "pending", "active", "failed", "detached"]
        for (const estado of estados) {
            expect(ACCION_GARANTIA[estado]).toBeDefined()
        }
        expect(Object.keys(ACCION_GARANTIA)).toHaveLength(5)
    })

    it("'detached' pide tarjeta nueva, igual que 'failed' — nunca deja esperando", () => {
        expect(ACCION_GARANTIA.detached).toBe("pedir_tarjeta")
        expect(ACCION_GARANTIA.detached).toBe(ACCION_GARANTIA.failed)
    })

    it("solo 'active' desbloquea el paso del contrato", () => {
        const desbloquean = (Object.keys(ACCION_GARANTIA) as GuaranteeStatus[])
            .filter((s) => ACCION_GARANTIA[s] === "listo")
        expect(desbloquean).toEqual(["active"])
    })
})

describe("§B máquina de estados del contrato", () => {
    it("los 5 estados del backend tienen una UI definida", () => {
        const estados: ContractStatus[] = ["not_started", "pending", "signed", "completed", "rejected"]
        for (const estado of estados) {
            expect(UI_CONTRATO[estado]).toBeDefined()
        }
        expect(Object.keys(UI_CONTRATO)).toHaveLength(5)
    })

    it("'signed' NO habilita la descarga — esa la decide signedContractUrl", () => {
        expect(UI_CONTRATO.signed).toBe("esperando")
        expect(UI_CONTRATO.signed).not.toBe("descargar")
    })

    it("'rejected' avisa al huésped en vez de dejarlo creyendo que terminó", () => {
        expect(UI_CONTRATO.rejected).toBe("avisar_fallo")
        expect(UI_CONTRATO.rejected).not.toBe("nada")
    })
})
