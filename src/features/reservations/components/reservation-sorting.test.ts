import { describe, it, expect } from "vitest"
import type { AutomationStatus, Reservation } from "@/types"
import {
    STATUS_ORDER,
    LIGHT_ORDER,
    DEFAULT_SORTING,
    compareText,
    compareDates,
    compareStatus,
    compareLight,
} from "./reservation-sorting"

describe("compareText", () => {
    it("ignora mayúsculas para que el orden sea el que la persona lee", () => {
        expect(compareText("ana", "Bruno")).toBeLessThan(0)
        expect(compareText("Bruno", "ana")).toBeGreaterThan(0)
    })

    // Con un `<` crudo, "Álvarez" (code point 193) cae después de "Zapata".
    it("coloca los acentos donde corresponde y no al final", () => {
        expect(compareText("Álvarez", "Zapata")).toBeLessThan(0)
        expect(compareText("Álvarez", "Alvarez")).toBe(0)
    })

    it("ordena números embebidos por valor, no por dígito", () => {
        expect(compareText("H2", "H10")).toBeLessThan(0)
    })

    it("sobrevive a un nombre vacío", () => {
        expect(compareText("", "Ana")).toBeLessThan(0)
    })
})

describe("compareDates", () => {
    const jul = new Date("2026-07-23T12:00:00Z")
    const ago = new Date("2026-08-05T12:00:00Z")

    it("ordena cronológicamente", () => {
        expect(compareDates(jul, ago)).toBeLessThan(0)
        expect(compareDates(ago, jul)).toBeGreaterThan(0)
        expect(compareDates(jul, jul)).toBe(0)
    })

    // Una fila sin fecha no debe colarse al principio y tapar las reales.
    it("manda las fechas ausentes o inválidas al final", () => {
        expect(compareDates(null, jul)).toBeGreaterThan(0)
        expect(compareDates(jul, undefined)).toBeLessThan(0)
        expect(compareDates(new Date("no-es-fecha"), jul)).toBeGreaterThan(0)
        expect(compareDates(null, null)).toBe(0)
    })
})

describe("compareStatus", () => {
    it("cubre los 12 estados del union", () => {
        const all: Reservation["status"][] = [
            "CONFIRMED", "IN_PROGRESS", "CANCELLED", "CLOSED", "DELETED", "UNKNOWN",
            "PENDING", "CHECKED_IN", "CHECKED_OUT", "LINK_SENT", "PENDING_CONTRACT", "NO_STARTED",
        ]
        for (const s of all) expect(STATUS_ORDER[s], s).toBeTypeOf("number")
    })

    // El orden alfabético del enum pondría CANCELLED antes que CONFIRMED.
    it("pone lo operable antes que lo terminal", () => {
        expect(compareStatus("CONFIRMED", "CANCELLED")).toBeLessThan(0)
        expect(compareStatus("IN_PROGRESS", "CLOSED")).toBeLessThan(0)
        expect(compareStatus("CONFIRMED", "IN_PROGRESS")).toBeLessThan(0)
    })

    it("ordena una lista completa de forma estable y determinista", () => {
        const input: Reservation["status"][] = ["DELETED", "CONFIRMED", "CANCELLED", "IN_PROGRESS"]
        expect([...input].sort(compareStatus)).toEqual([
            "CONFIRMED", "IN_PROGRESS", "CANCELLED", "DELETED",
        ])
    })
})

describe("compareLight", () => {
    const light = (v: Partial<AutomationStatus>): AutomationStatus => ({
        link: "none", checkin: "none", contract: "none", code: "none",
        tra: "none", sireIn: "none", sireOut: "none", ...v,
    })

    // Ordenar por CONTRATO sirve para "¿cuáles faltan por firmar?".
    it("pone lo pendiente primero, luego lo hecho, luego lo no configurado", () => {
        expect(LIGHT_ORDER.pending).toBeLessThan(LIGHT_ORDER.success)
        expect(LIGHT_ORDER.success).toBeLessThan(LIGHT_ORDER.none)
    })

    it("compara la luz pedida y no otra", () => {
        const a = light({ contract: "pending", link: "success" })
        const b = light({ contract: "success", link: "pending" })
        expect(compareLight("contract", a, b)).toBeLessThan(0)
        expect(compareLight("link", a, b)).toBeGreaterThan(0)
    })

    // `automationStatus` es opcional en Reservation.
    it("trata una reserva sin automationStatus como 'none'", () => {
        expect(compareLight("contract", undefined, light({ contract: "pending" }))).toBeGreaterThan(0)
        expect(compareLight("contract", undefined, undefined)).toBe(0)
    })
})

describe("DEFAULT_SORTING", () => {
    // El pedido explícito: ordenar por check-in, no por created_at, que no es
    // una columna visible de la tabla.
    it("ordena por la fecha de check-in", () => {
        expect(DEFAULT_SORTING).toHaveLength(1)
        expect(DEFAULT_SORTING[0].id).toBe("checkIn")
    })
})
