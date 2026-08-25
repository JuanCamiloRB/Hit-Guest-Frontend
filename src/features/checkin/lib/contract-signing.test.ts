import { describe, it, expect } from "vitest"
import {
    resolveContractSigningState,
    isContractTransitional,
    blocksContractSubmission,
    isNativeProvider,
    isExternalProvider,
} from "./contract-signing"
import type { PortalContractInfo } from "@/features/checkin/types/checkin"

const contract = (over: Partial<PortalContractInfo>): PortalContractInfo => ({
    signingProvider: "tufirma",
    status: "not_started",
    hasNativeSignature: false,
    signedAt: null,
    signedContractUrl: null,
    ...over,
})

describe("resolveContractSigningState", () => {
    describe("sin contrato configurado", () => {
        it("trata la ausencia de `contract` como no configurado", () => {
            expect(resolveContractSigningState(undefined)).toBe("not_configured")
            expect(resolveContractSigningState(null)).toBe("not_configured")
        })

        it("ignora el `status` cuando no hay proveedor", () => {
            // Un backend viejo puede mandar `contract` sin routing resuelto para
            // este canal. Sin proveedor no hay nada que firmar: leer el status
            // igual haría que el portal anunciara una firma inexistente.
            expect(resolveContractSigningState(contract({ signingProvider: null, status: "pending" })))
                .toBe("not_configured")
        })
    })

    describe("rechazo — gana sobre cualquier otra señal", () => {
        it("reporta `rejected` aunque exista una URL descargable", () => {
            // Es lo único que el huésped no puede resolver por su cuenta. Si la
            // descarga tuviera precedencia, la pantalla mostraría "contrato listo"
            // sobre una firma que TuFirma rechazó.
            expect(resolveContractSigningState(contract({
                status: "rejected",
                signedContractUrl: "/api/v1/checkin/x/contract/signed",
            }))).toBe("rejected")
        })

        it("reporta `rejected` también con el proveedor nativo", () => {
            expect(resolveContractSigningState(contract({
                signingProvider: "hitguest_signature",
                status: "rejected",
            }))).toBe("rejected")
        })
    })

    describe("descarga — solo `signedContractUrl` la habilita", () => {
        it("marca `available` cuando el backend publica la URL", () => {
            expect(resolveContractSigningState(contract({
                status: "completed",
                signedContractUrl: "/api/v1/checkin/x/contract/signed",
            }))).toBe("available")
        })

        it("NO marca `available` por `status: signed` sin URL", () => {
            // `signed` se pone en cuanto el titular firma, ANTES de que el PDF
            // exista. Derivar la descarga de ahí mostraba un botón que fallaba.
            expect(resolveContractSigningState(contract({
                signingProvider: "hitguest_signature",
                status: "signed",
                hasNativeSignature: true,
            }))).toBe("finalizing")
        })

        it("NO marca `available` por `status: completed` sin URL", () => {
            expect(resolveContractSigningState(contract({ status: "completed" })))
                .toBe("finalizing")
        })
    })

    describe("`pending` significa cosas opuestas según el proveedor", () => {
        it("con TuFirma la pelota la tiene el huésped, en su correo", () => {
            expect(resolveContractSigningState(contract({ signingProvider: "tufirma", status: "pending" })))
                .toBe("awaiting_external")
        })

        it("con el proveedor nativo no hay nada externo que esperar", () => {
            expect(resolveContractSigningState(contract({
                signingProvider: "hitguest_signature",
                status: "pending",
            }))).toBe("finalizing")
            expect(resolveContractSigningState(contract({
                signingProvider: "hitguest",
                status: "pending",
            }))).toBe("finalizing")
        })
    })

    describe("acción pendiente del huésped dentro del portal", () => {
        it("`not_started` con proveedor es acción del huésped", () => {
            expect(resolveContractSigningState(contract({ status: "not_started" })))
                .toBe("awaiting_guest")
            expect(resolveContractSigningState(contract({
                signingProvider: "hitguest_signature",
                status: "not_started",
            }))).toBe("awaiting_guest")
        })

        it("un `status` desconocido de un backend nuevo no bloquea al huésped", () => {
            // Fail-open a propósito: inventar un bloqueo por un valor que no
            // conocemos deja al huésped sin poder completar su check-in, que es
            // peor que ofrecerle el formulario y que el backend lo rechace.
            expect(resolveContractSigningState(contract({
                status: "algo_nuevo" as PortalContractInfo["status"],
            }))).toBe("awaiting_guest")
        })
    })
})

describe("isContractTransitional", () => {
    it("solo sondea mientras el estado todavía puede cambiar solo", () => {
        expect(isContractTransitional("awaiting_external")).toBe(true)
        expect(isContractTransitional("finalizing")).toBe(true)
    })

    it("no sondea en estados terminales ni cuando falta el huésped", () => {
        expect(isContractTransitional("available")).toBe(false)
        expect(isContractTransitional("rejected")).toBe(false)
        expect(isContractTransitional("awaiting_guest")).toBe(false)
        expect(isContractTransitional("not_configured")).toBe(false)
    })
})

describe("blocksContractSubmission", () => {
    it("bloquea al titular que ya envió y espera la firma externa", () => {
        // El caso del reingreso: con TuFirma el titular queda incompleto hasta el
        // webhook, así que el hub lo devuelve a la pantalla del contrato.
        expect(blocksContractSubmission("awaiting_external", true)).toBe(true)
    })

    it("bloquea al titular tras un rechazo terminal", () => {
        expect(blocksContractSubmission("rejected", true)).toBe(true)
    })

    it("deja pasar al titular que todavía tiene que aceptar o firmar", () => {
        expect(blocksContractSubmission("awaiting_guest", true)).toBe(false)
        expect(blocksContractSubmission("not_configured", true)).toBe(false)
    })

    it("deja pasar la recuperación de un contrato ya firmado", () => {
        // `finalizing` es el titular que firmó pero cuyo `/main/complete` falló:
        // tiene que poder reintentar la finalización sin volver a firmar.
        expect(blocksContractSubmission("finalizing", true)).toBe(false)
        expect(blocksContractSubmission("available", true)).toBe(false)
    })

    it("nunca bloquea a un acompañante", () => {
        // El acompañante no firma nunca. Bloquearlo por el contrato del titular
        // le impediría completar su propio registro.
        expect(blocksContractSubmission("awaiting_external", false)).toBe(false)
        expect(blocksContractSubmission("rejected", false)).toBe(false)
    })
})

describe("proveedores", () => {
    it("reconoce el slug nativo y su forma corta", () => {
        expect(isNativeProvider("hitguest_signature")).toBe(true)
        expect(isNativeProvider("hitguest")).toBe(true)
        expect(isNativeProvider("tufirma")).toBe(false)
        expect(isNativeProvider(null)).toBe(false)
    })

    it("reconoce el proveedor externo", () => {
        expect(isExternalProvider("tufirma")).toBe(true)
        expect(isExternalProvider("hitguest_signature")).toBe(false)
        expect(isExternalProvider(undefined)).toBe(false)
    })
})
