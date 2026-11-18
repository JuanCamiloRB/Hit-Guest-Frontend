import { describe, expect, it } from "vitest"
import type { AutomationStatusItem } from "@/features/properties/types/automation"
import {
    CELL_SEVERITY,
    buildAutomationCells,
    cellAccessibleName,
    classifyItem,
    formatMoment,
    readDigitalContract,
    type CellSources,
} from "./automation-cells"
import { readCheckinLinkDelivery } from "./checkin-link-delivery-status"

function item(overrides: Partial<AutomationStatusItem>): AutomationStatusItem {
    return {
        automationUuid: "a",
        automationName: "TRA Colombia",
        providerSlug: "tra_colombia",
        status: "not_started",
        lastError: null,
        lastRunAt: null,
        usageRecordId: null,
        contractPdfPath: null,
        wasSuccessful: false,
        lastSuccessAt: null,
        requiresCheckin: null,
        redispatchRequiresCheckin: null,
        canManualDispatch: true,
        isPerGuest: false,
        guests: [],
        reservationCheckinCompleted: false,
        mainGuestCheckinCompleted: false,
        canDispatch: false,
        canRedispatch: false,
        ...overrides,
    }
}

const NO_COUNT = { completed: undefined, total: undefined, isCheckinCompleted: false }
const src = (overrides: Partial<CellSources> = {}): CellSources => ({
    items: [],
    delivery: readCheckinLinkDelivery({}),
    contract: null,
    checkin: NO_COUNT,
    ...overrides,
})

describe("classifyItem — a qué columna va cada automatización", () => {
    it("el envío del link NO cuenta como check-in aunque su nombre diga «Check-in»", () => {
        expect(classifyItem({ providerSlug: "whatsapp_checkin_link", automationName: "Check-in Link Delivery" })).toBe("link")
        expect(classifyItem({ providerSlug: "otro", automationName: "Check-in Link Delivery" })).toBe("link")
    })

    it("identidad, firma, acceso, TRA, SIRE in/out y reporte PDF por slug; desconocidos sin columna", () => {
        expect(classifyItem({ providerSlug: "didit", automationName: "Identity Verification - Main Guest" })).toBe("identity")
        expect(classifyItem({ providerSlug: "textract", automationName: "Identity Verification - Secondary Guests" })).toBe("identity")
        expect(classifyItem({ providerSlug: "hitguest_signature", automationName: "Digital Signature for Contract" })).toBe("contract")
        expect(classifyItem({ providerSlug: "tufirma", automationName: "Digital Signature for Contract" })).toBe("contract")
        expect(classifyItem({ providerSlug: "ttlock", automationName: "Smart Lock Codes" })).toBe("code")
        expect(classifyItem({ providerSlug: "tra_colombia", automationName: "TRA Colombia" })).toBe("tra")
        expect(classifyItem({ providerSlug: "sire_colombia", automationName: "SIRE Colombia — Check-in" })).toBe("sireIn")
        expect(classifyItem({ providerSlug: "sire_colombia", automationName: "SIRE Colombia — Check-out" })).toBe("sireOut")
        expect(classifyItem({ providerSlug: "pdf_report", automationName: "Guest Report PDF" })).toBe("pdf")
        expect(classifyItem({ providerSlug: "nuevo", automationName: "Algo nuevo" })).toBeNull()
    })
})

describe("estados de una automatización", () => {
    it("«no_started» es «todavía no corre» (idle), distinto de no configurada («—»)", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "not_started" })] }))
        expect(cells.tra).toMatchObject({ state: "idle", summary: "todavía no corre" })
        expect(cells.code).toMatchObject({ state: "none" })
        expect(cells.code!.lines[0].text).toBe("El acceso no está configurado")
    })

    it("un fallo es «failed» (rojo), no pendiente; con la frase de error si la hay", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "failed", lastRunAt: "2026-11-18 10:42:00", lastError: "El RNT no coincide con la propiedad" })] }))
        expect(cells.tra!.state).toBe("failed")
        expect(cells.tra!.lines[0].text).toBe("Falló · 18 nov, 10:42: El RNT no coincide con la propiedad")
    })

    it("un código de error suelto no se muestra; «identity_not_verified» sí, en palabras", () => {
        const tra = buildAutomationCells(src({ items: [item({ status: "failed", lastError: "rnt_mismatch" })] })).tra!
        expect(tra.lines[0].text).toBe("Falló")
        const checkin = buildAutomationCells(src({ items: [item({ providerSlug: "didit", automationName: "Identity Verification - Main Guest", status: "failed", lastError: "identity_not_verified" })] })).checkin!
        // La identidad no pone Check-in en rojo (decisión 2026-08-21): va al detalle.
        expect(checkin.state).toBe("pending")
        expect(checkin.lines[1].state).toBe("failed")
        expect(checkin.lines[1].text).toMatch(/falló: La identidad no se verificó$/)
    })

    it("falló después de un envío correcto: degradado (pending), no un fallo de cero", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "failed", wasSuccessful: true })] }))
        expect(cells.tra!.state).toBe("pending")
        expect(cells.tra!.lines[0].text).toMatch(/^Falló después de un envío correcto/)
    })

    it("credenciales rechazadas: en pausa (pending) con qué hacer, mande lo que mande el status", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "failed", lastError: "credentials_rejected" })] }))
        expect(cells.tra!).toMatchObject({ state: "pending", note: "Actualiza las credenciales en la propiedad" })
        expect(cells.tra!.lines[0].text).toBe("En pausa: el proveedor rechazó las credenciales")
    })

    it("completado usa la fecha del último éxito", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "completed", lastSuccessAt: "2026-11-16 12:31:00", lastRunAt: "2026-11-17 09:00:00" })] }))
        expect(cells.tra!.lines[0]).toEqual({ state: "success", text: "Completado · 16 nov, 12:31" })
    })

    it("por huésped (SIRE): contador de los que aplican y una línea por huésped", () => {
        const sire = item({
            providerSlug: "sire_colombia", automationName: "SIRE Colombia — Check-in", status: "pending", isPerGuest: true,
            guests: [
                { guestUuid: "g1", name: "Ana", isMainGuest: true, checkinCompleted: true, status: "completed", usageRecordId: 1, lastError: null, lastRunAt: null, canDispatch: false, canRedispatch: false },
                { guestUuid: "g2", name: "", isMainGuest: false, checkinCompleted: false, status: "not_started", usageRecordId: null, lastError: null, lastRunAt: null, canDispatch: false, canRedispatch: false },
                { guestUuid: "g3", name: "Luis", isMainGuest: false, checkinCompleted: true, status: "skipped", usageRecordId: null, lastError: null, lastRunAt: null, canDispatch: false, canRedispatch: false },
            ],
        })
        const cell = buildAutomationCells(src({ items: [sire] })).sireIn!
        expect(cell.count).toEqual({ done: 1, total: 2 })
        // Un huésped ya reportado y otro sin empezar: EN CURSO, no «todavía no corre».
        expect(cell.state).toBe("pending")
        expect(cell.lines.map((l) => l.text)).toEqual(["Ana · reportado", "Acompañante · todavía no", "Luis · no aplica"])
    })

    it("sin el estado todavía (items undefined), las celdas que dependen de él son null (cargando)", () => {
        const cells = buildAutomationCells(src({ items: undefined }))
        expect(cells.tra).toBeNull()
        expect(cells.code).toBeNull()
        expect(cells.link).toBeNull()
        expect(cells.contract).toBeNull()
        expect(cells.checkin).toBeNull()
    })
})

describe("Link — el envío real por canal, no «corrió algo»", () => {
    it("antes era verde si corría CUALQUIER automatización: ahora sin envío registrado es «todavía no se envía», nunca «no configurado» (el link sale por correo siempre)", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "completed" })] }))
        expect(cells.link).toMatchObject({ state: "idle", summary: "todavía no se envía" })
        expect(cells.link!.lines[0].text).toBe("Sin envío registrado todavía")
    })

    it("WhatsApp y correo con su estado y fecha; canales en orden fijo", () => {
        const delivery = readCheckinLinkDelivery({
            checkinLinkSentAt: "2026-11-18T15:42:00Z", mailDeliveryStatus: "delivered",
            checkinLinkWhatsappSentAt: "2026-11-18T15:42:00Z", whatsappDeliveryStatus: "read",
        })
        const cell = buildAutomationCells(src({ delivery, items: undefined })).link!
        expect(cell.state).toBe("success")
        expect(cell.channels).toEqual(["whatsapp", "email"])
        expect(cell.lines.map((l) => l.text.split(" · ")[0] + " · " + l.text.split(" · ")[1])).toEqual(["WhatsApp · leído", "Correo · entregado"])
        // El envío del link está listo aunque el estado de automatizaciones no haya llegado.
        expect(cellAccessibleName("link", cell)).toBe("Link: enviado por WhatsApp y correo")
    })

    it("un canal falló y otro llegó: pide atención (pending), no es un fallo total", () => {
        const delivery = readCheckinLinkDelivery({
            checkinLinkSentAt: "2026-11-18T15:42:00Z",
            checkinLinkWhatsappSentAt: "2026-11-18T15:42:00Z", whatsappDeliveryStatus: "failed", whatsappDeliveryReason: "El número no tiene WhatsApp",
        })
        const cell = buildAutomationCells(src({ delivery })).link!
        expect(cell.state).toBe("pending")
        expect(cell.summary).toBe("un canal necesita revisión")
        expect(cell.lines[0]).toMatchObject({ state: "failed" })
        expect(cell.lines[0].text).toMatch(/El número no tiene WhatsApp · No se cobró este mensaje\.$/)
        expect(cell.lines[1]).toMatchObject({ state: "success" })
    })

    it("todos los canales fallaron: failed", () => {
        const delivery = readCheckinLinkDelivery({ checkinLinkSentAt: "2026-11-18T15:42:00Z", mailDeliveryStatus: "failed" })
        expect(buildAutomationCells(src({ delivery })).link).toMatchObject({ state: "failed", summary: "no se pudo entregar" })
    })

    it("OTA: publicado, con la nota de que no confirma lectura", () => {
        const delivery = readCheckinLinkDelivery({ checkinLinkOtaSentAt: "2026-11-16T14:15:00Z", checkinLinkOtaVia: "kunas_pms" })
        const cell = buildAutomationCells(src({ delivery })).link!
        expect(cell).toMatchObject({ state: "success", channels: ["ota"], note: "La OTA no confirma si el huésped leyó el mensaje" })
    })

    it("sin envío todavía, con la automatización de link sin correr: idle", () => {
        const cells = buildAutomationCells(src({ items: [item({ providerSlug: "whatsapp_checkin_link", automationName: "Check-in Link Delivery", status: "not_started" })] }))
        expect(cells.link).toMatchObject({ state: "idle", channels: [] })
    })
})

describe("Check-in — cuenta check-ins COMPLETOS (decisión 2026-08-21)", () => {
    it("1 de 2: pendiente con contador; la identidad va al detalle y no cambia el color", () => {
        const items = [item({ providerSlug: "didit", automationName: "Identity Verification - Main Guest", status: "failed", lastError: "identity_not_verified" })]
        const cell = buildAutomationCells(src({ items, checkin: { completed: 1, total: 2, isCheckinCompleted: false } })).checkin!
        expect(cell.state).toBe("pending")
        expect(cell.count).toEqual({ done: 1, total: 2 })
        expect(cell.lines[0].text).toBe("1 de 2 huéspedes completaron su check-in")
        expect(cell.lines[1].state).toBe("failed")
        expect(cell.lines[1].text).toMatch(/^Verificación .* · falló: La identidad no se verificó$/)
    })

    it("todos completos o el flag de la reserva: verde con total/total", () => {
        expect(buildAutomationCells(src({ checkin: { completed: 2, total: 2, isCheckinCompleted: false } })).checkin).toMatchObject({ state: "success", count: { done: 2, total: 2 } })
        expect(buildAutomationCells(src({ checkin: { completed: 0, total: 3, isCheckinCompleted: true } })).checkin).toMatchObject({ state: "success", count: { done: 3, total: 3 } })
    })

    it("un backend que reporta más completos que el total no pinta 3 de 2", () => {
        expect(buildAutomationCells(src({ checkin: { completed: 3, total: 2, isCheckinCompleted: false } })).checkin!.count).toEqual({ done: 2, total: 2 })
    })

    it("sin conteo: el flag dice que NO está completo, así que nunca es verde ni rojo; en curso o sin empezar; sin identidad, «—»", () => {
        const done = [item({ providerSlug: "textract", automationName: "Identity Verification - Main Guest", status: "completed" })]
        expect(buildAutomationCells(src({ items: done })).checkin).toMatchObject({ state: "pending", summary: "check-in en curso" })
        const failed = [item({ providerSlug: "didit", automationName: "Identity Verification - Main Guest", status: "failed" })]
        expect(buildAutomationCells(src({ items: failed })).checkin!.state).toBe("pending")
        const notStarted = [item({ providerSlug: "textract", automationName: "Identity Verification - Main Guest", status: "not_started" })]
        expect(buildAutomationCells(src({ items: notStarted })).checkin!.state).toBe("idle")
        expect(buildAutomationCells(src({ items: [] })).checkin!.state).toBe("none")
    })
})

describe("Contrato — qué se firmó, con quién y cuándo", () => {
    it("readDigitalContract lee la forma observada; un tipo desconocido queda null", () => {
        expect(readDigitalContract({ digitalContract: { provider: "tufirma", status: "completed", signedAt: "2026-11-07T21:40:00Z", contractType: "guarantee_only" } }))
            .toMatchObject({ provider: "tufirma", status: "completed", contractType: "guarantee_only", notIssued: null })
        expect(readDigitalContract({ digitalContract: { contractType: "otro" } })!.contractType).toBeNull()
        expect(readDigitalContract({ digitalContract: { notIssued: { reason: "missing_document", detectedAt: "x" } } })!.notIssued).toEqual({ reason: "missing_document" })
        expect(readDigitalContract({})).toBeNull()
        expect(readDigitalContract(null)).toBeNull()
    })

    it("firmado: el tipo de contrato y el proveedor, aunque el estado de automatizaciones no haya llegado", () => {
        const contract = readDigitalContract({ digitalContract: { provider: "hitguest", status: "completed", signedAt: "2026-11-18 11:05:00", contractType: "agreement_only" } })
        const cell = buildAutomationCells(src({ contract, items: undefined })).contract!
        expect(cell).toMatchObject({ state: "success", note: "Firma nativa de HitGuest" })
        expect(cell.lines[0].text).toBe("Contrato de alquiler · firmado · 18 nov, 11:05")
    })

    it("sin tipo: «Contrato» a secas, nunca uno inventado", () => {
        const contract = readDigitalContract({ digitalContract: { provider: "hitguest", status: "completed", signedAt: null } })
        expect(buildAutomationCells(src({ contract })).contract!.lines[0].text).toBe("Contrato · firmado")
    })

    it("no se emitió: failed con qué revisar", () => {
        const contract = readDigitalContract({ digitalContract: { notIssued: { reason: "missing_document" } } })
        expect(buildAutomationCells(src({ contract })).contract).toMatchObject({ state: "failed", note: "Revisa el texto del contrato en la propiedad" })
    })

    it("enviado a firmar (requestedAt) con la firma sin correr: pendiente", () => {
        const contract = readDigitalContract({ digitalContract: { provider: "tufirma", requestedAt: "2026-11-18 09:00:00" } })
        const items = [item({ providerSlug: "tufirma", automationName: "Digital Signature for Contract", status: "pending" })]
        expect(buildAutomationCells(src({ contract, items })).contract).toMatchObject({ state: "pending", summary: "enviado a firmar", note: "TuFirma" })
    })

    it("sin contrato y sin firma configurada: «—»", () => {
        expect(buildAutomationCells(src({ items: [] })).contract!.state).toBe("none")
    })
})

describe("formatMoment y severidad", () => {
    it("hora de Bogotá sin zona se muestra tal cual; basura es null", () => {
        expect(formatMoment("2026-11-18 10:42:00")).toBe("18 nov, 10:42")
        expect(formatMoment("no es fecha")).toBeNull()
        expect(formatMoment(null)).toBeNull()
    })

    it("ordenar por severidad: falló, pendiente, todavía no corre, completado, no configurado", () => {
        const order = (["success", "none", "idle", "failed", "pending"] as const).slice().sort((a, b) => CELL_SEVERITY[a] - CELL_SEVERITY[b])
        expect(order).toEqual(["failed", "pending", "idle", "success", "none"])
    })
})

describe("auditoría 2026-11-19 — lo que el dato no dice no se afirma", () => {
    const guest = (name: string, status: string, lastError: string | null = null) => ({
        guestUuid: name, name, isMainGuest: false, checkinCompleted: true, status, usageRecordId: null, lastError, lastRunAt: null, canDispatch: false, canRedispatch: false,
    }) as AutomationStatusItem["guests"][number]

    it("un estado de entrega que el contrato no documenta (bounced) NO sale verde: pide revisión", () => {
        const delivery = readCheckinLinkDelivery({ checkinLinkSentAt: "2026-11-18T15:42:00Z", mailDeliveryStatus: "bounced" })
        expect(buildAutomationCells(src({ delivery })).link).toMatchObject({ state: "pending", summary: "un canal necesita revisión" })
    })

    it("correo marcado como spam: llegó, pero pide revisión (no «no se entregó»)", () => {
        const delivery = readCheckinLinkDelivery({ checkinLinkSentAt: "2026-11-18T15:42:00Z", mailDeliveryStatus: "complained" })
        const cell = buildAutomationCells(src({ delivery })).link!
        expect(cell.state).toBe("pending")
        expect(cell.lines[0].text).toMatch(/^Correo · marcado como spam/)
    })

    it("credenciales rechazadas sobre algo COMPLETADO no es «en pausa» (misma regla que el panel)", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "completed", lastError: "credentials_rejected" })] }))
        expect(cells.tra!.state).toBe("success")
        expect(cells.tra!.note).toBeUndefined()
    })

    it("por huésped: un huésped en pausa por credenciales es «en pausa» (no rojo) y la celda dice qué hacer", () => {
        const sire = item({ providerSlug: "sire_colombia", automationName: "SIRE Colombia — Check-in", status: "pending", isPerGuest: true,
            guests: [guest("Ana", "failed", "credentials_rejected"), guest("Luis", "completed")] })
        const cell = buildAutomationCells(src({ items: [sire] })).sireIn!
        expect(cell.state).toBe("pending")
        expect(cell.lines[0]).toEqual({ state: "pending", text: "Ana · en pausa: el proveedor rechazó las credenciales" })
        expect(cell.note).toBe("Actualiza las credenciales en la propiedad")
    })

    it("SIRE con todos los huéspedes «no aplica»: dice «no aplica», no «no configurado»", () => {
        const sire = item({ providerSlug: "sire_colombia", automationName: "SIRE Colombia — Check-in", status: "completed", isPerGuest: true,
            guests: [guest("Ana", "skipped"), guest("Luis", "skipped")] })
        const cell = buildAutomationCells(src({ items: [sire] })).sireIn!
        expect(cell).toMatchObject({ state: "none", summary: "no aplica" })
        expect(cellAccessibleName("sireIn", cell)).toBe("SIRE in: no aplica")
    })

    it("dos filas para la misma columna: un fallo de cualquiera manda (no se esconde detrás de la primera)", () => {
        const cells = buildAutomationCells(src({ items: [item({ status: "completed" }), item({ status: "failed" })] }))
        expect(cells.tra!.state).toBe("failed")
        expect(cells.tra!.lines).toHaveLength(2)
    })

    it("los códigos que la app ya traduce se dicen en palabras (saldo, credenciales, precio)", () => {
        const tra = buildAutomationCells(src({ items: [item({ status: "failed", lastError: "insufficient_balance" })] })).tra!
        expect(tra.lines[0].text).toBe("Falló: Saldo insuficiente. Recarga tu saldo para ejecutar esta automatización.")
        const asObject = buildAutomationCells(src({ items: [item({ status: "failed", lastError: { message: "insufficient_balance" } as unknown as string })] })).tra!
        expect(asObject.lines[0].text).toMatch(/Saldo insuficiente/)
    })

    it("contrato: la firma ya COMPLETADA no se pisa con «enviado a firmar»", () => {
        const contract = readDigitalContract({ digitalContract: { provider: "tufirma", requestedAt: "2026-11-18 09:00:00" } })
        const items = [item({ providerSlug: "tufirma", automationName: "Digital Signature for Contract", status: "completed" })]
        expect(buildAutomationCells(src({ contract, items })).contract!.state).toBe("success")
    })

    it("contrato enviado a firmar sin la automatización activa: «enviado a firmar», no «no configurado»", () => {
        const contract = readDigitalContract({ digitalContract: { provider: "tufirma", requestedAt: "2026-11-18 09:00:00" } })
        expect(buildAutomationCells(src({ contract, items: [] })).contract).toMatchObject({ state: "pending", summary: "enviado a firmar" })
    })

    it("contrato con un estado que no conocemos: ni «firmado» ni «enviado a firmar»; por revisar", () => {
        const revoked = readDigitalContract({ digitalContract: { provider: "tufirma", status: "revoked", signedAt: "2026-11-18 11:00:00" } })
        expect(buildAutomationCells(src({ contract: revoked, items: [] })).contract).toMatchObject({ state: "pending", summary: "por revisar" })
        const rejected = readDigitalContract({ digitalContract: { provider: "tufirma", status: "rejected", requestedAt: "2026-11-18 09:00:00" } })
        expect(buildAutomationCells(src({ contract: rejected, items: [] })).contract!.summary).toBe("por revisar")
    })

    it("fechas: todo en hora de Bogotá; un ISO con zona se convierte, la hora de pared se muestra tal cual", () => {
        // 15:42 UTC = 10:42 en Bogotá (UTC−5), sea cual sea la zona del navegador.
        expect(formatMoment("2026-11-18T15:42:00Z")).toBe("18 nov, 10:42")
        expect(formatMoment("2026-11-18T15:42:00.000000Z")).toBe("18 nov, 10:42")
        // La hora de pared no pasa por `Date`: no cae en un cambio de horario.
        expect(formatMoment("2026-03-29 02:30:00")).toBe("29 mar, 02:30")
    })
})

describe("Reporte PDF de huéspedes", () => {
    const pdf = (overrides: Partial<AutomationStatusItem>) => item({ providerSlug: "pdf_report", automationName: "Guest Report PDF", ...overrides })

    it("enviado: completado con su fecha y a quién va", () => {
        const cell = buildAutomationCells(src({ items: [pdf({ status: "completed", lastSuccessAt: "2026-11-18 12:00:00" })] })).pdf!
        expect(cell).toMatchObject({ state: "success", note: "Se envía por correo a los destinatarios de la propiedad" })
        expect(cell.lines[0].text).toBe("Completado · 18 nov, 12:00")
        expect(cellAccessibleName("pdf", cell)).toBe("PDF: completado")
    })

    it("falló con el check-in completo: dice que se puede reenviar desde la ficha", () => {
        const cell = buildAutomationCells(src({ items: [pdf({ status: "failed", reservationCheckinCompleted: true })] })).pdf!
        expect(cell).toMatchObject({ state: "failed", note: "Puedes reenviarlo desde la ficha de la reserva" })
    })

    it("sin la automatización: «—» («no configurado»), y cargando mientras no llega el estado", () => {
        expect(buildAutomationCells(src({ items: [] })).pdf).toMatchObject({ state: "none" })
        expect(buildAutomationCells(src({ items: undefined })).pdf).toBeNull()
    })
})

