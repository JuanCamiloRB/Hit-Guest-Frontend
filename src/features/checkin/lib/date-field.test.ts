import { describe, expect, it } from "vitest"
import {
    acceptSegmentInput,
    composeDateValue,
    dateFieldError,
    splitDateValue,
} from "./date-field"

describe("splitDateValue / composeDateValue", () => {
    it("hace round-trip del mismo YYYY-MM-DD que emitía el input nativo", () => {
        expect(splitDateValue("1983-08-05")).toEqual({ year: "1983", month: "08", day: "05" })
        expect(composeDateValue({ year: "1983", month: "08", day: "05" })).toBe("1983-08-05")
    })

    it("un valor que no es fecha ISO no revienta el prefill del OCR", () => {
        expect(splitDateValue("05/08/1983")).toEqual({ day: "", month: "", year: "" })
        expect(splitDateValue("")).toEqual({ day: "", month: "", year: "" })
        expect(splitDateValue(undefined)).toEqual({ day: "", month: "", year: "" })
    })

    it("pad de segmentos cortos al componer", () => {
        expect(composeDateValue({ day: "5", month: "8", year: "1983" })).toBe("1983-08-05")
    })

    it("incompleto o imposible compone vacío, nunca una fecha corregida", () => {
        expect(composeDateValue({ day: "30", month: "02", year: "1990" })).toBe("")
        expect(composeDateValue({ day: "01", month: "13", year: "1990" })).toBe("")
        expect(composeDateValue({ day: "01", month: "01", year: "189" })).toBe("")
        expect(composeDateValue({ day: "", month: "01", year: "1990" })).toBe("")
        // El constructor de Date "arregla" el 30/02 a marzo — acá debe ser inválido.
        expect(composeDateValue({ day: "29", month: "02", year: "2024" })).toBe("2024-02-29")
        expect(composeDateValue({ day: "29", month: "02", year: "2023" })).toBe("")
    })
})

describe("dateFieldError", () => {
    it("calla mientras la fecha está a medias: un campo vacío no es un error", () => {
        expect(dateFieldError({ day: "30", month: "02", year: "" })).toBeNull()
        expect(dateFieldError({ day: "30", month: "", year: "1990" })).toBeNull()
    })

    it("con los tres llenos nombra el problema", () => {
        expect(dateFieldError({ day: "30", month: "02", year: "1990" })).toMatch(/no existe/)
        expect(dateFieldError({ day: "05", month: "08", year: "1983" })).toBeNull()
    })

    it("respeta el tope de fecha no futura (el que ya tenía nacimiento)", () => {
        expect(dateFieldError({ day: "01", month: "01", year: "2030" }, "2026-09-04")).toMatch(/futura/)
        expect(dateFieldError({ day: "01", month: "01", year: "2020" }, "2026-09-04")).toBeNull()
    })
})

describe("acceptSegmentInput — la regla de menor fricción", () => {
    it("un primer dígito imposible se completa solo y avanza: 5/12/1983 son 7 teclas", () => {
        expect(acceptSegmentInput("day", "5")).toEqual({ value: "05", advance: true })
        expect(acceptSegmentInput("month", "4")).toEqual({ value: "04", advance: true })
    })

    it("un primer dígito ambiguo espera el segundo", () => {
        expect(acceptSegmentInput("day", "1")).toEqual({ value: "1", advance: false })
        expect(acceptSegmentInput("day", "13")).toEqual({ value: "13", advance: true })
        expect(acceptSegmentInput("month", "1")).toEqual({ value: "1", advance: false })
        expect(acceptSegmentInput("month", "12")).toEqual({ value: "12", advance: true })
    })

    it("ignora lo que no es dígito y corta al largo del segmento", () => {
        expect(acceptSegmentInput("day", "1a2")).toEqual({ value: "12", advance: true })
        expect(acceptSegmentInput("year", "19833")).toEqual({ value: "1983", advance: false })
    })
})
