import { describe, expect, it } from "vitest"
import type { Reservation } from "@/types"
import { filterReservations, guestText, occupancyRows, periodLabel, pruneSelection, stayDetails, stayLabel, windowDays } from "./occupancy"

const d = (day: number, month = 10) => new Date(2026, month - 1, day)
function res(id: string, unit: string, checkIn: Date, checkOut: Date, extra: Partial<Reservation> = {}): Reservation {
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000)
    return {
        id, guestName: `Huésped ${id}`, propertyId: "p1", propertyName: "Nomad House", unitId: unit, unitName: unit,
        checkIn, checkOut, nights, status: "CONFIRMED", source: null, totalPrice: 0, ...extra,
    } as Reservation
}

describe("ocupación: ventana y rótulo del periodo", () => {
    it("14 días desde el inicio, a medianoche", () => {
        const days = windowDays(new Date(2026, 9, 16, 15, 30))
        expect(days).toHaveLength(14)
        expect(days[0]).toEqual(d(16))
        expect(days[13]).toEqual(d(29))
    })
    it("«16–29 octubre 2026», entre meses y entre años", () => {
        expect(periodLabel(windowDays(d(16)))).toBe("16–29 octubre 2026")
        expect(periodLabel(windowDays(d(28)))).toBe("28 oct – 10 nov 2026")
        expect(periodLabel(windowDays(d(25, 12)))).toBe("25 dic 2026 – 7 ene 2027")
    })
})

describe("ocupación: barras", () => {
    const start = d(16)
    it("del centro del check-in al centro del checkout, con las dos marcas si caen en la vista", () => {
        const [row] = occupancyRows([res("k", "1201", d(16), d(18))], start)
        expect(row.bars[0]).toMatchObject({ start: 0.5, end: 2.5, checkin: true, checkout: true, track: 0 })
    })
    it("recortada a la vista: sin la marca del extremo que queda afuera", () => {
        const rows = occupancyRows([res("a", "A", d(10), d(20)), res("b", "B", d(25), d(5, 11))], start)
        expect(rows.find((r) => r.unitName === "A")!.bars[0]).toMatchObject({ start: 0, end: 4.5, checkin: false, checkout: true })
        expect(rows.find((r) => r.unitName === "B")!.bars[0]).toMatchObject({ start: 9.5, end: 14, checkin: true, checkout: false })
    })
    it("fuera de la vista o cancelada/eliminada: no entra; sale el primer día: sí (medio día con su checkout)", () => {
        const rows = occupancyRows([
            res("antes", "A", d(1), d(15)),
            res("despues", "B", d(30), d(2, 11)),
            res("cancelada", "C", d(17), d(19), { status: "CANCELLED" }),
            res("borrada", "D", d(17), d(19), { status: "DELETED" }),
            res("sale-hoy", "E", d(10), d(16)),
        ], start)
        expect(rows.map((r) => r.unitName)).toEqual(["E"])
        expect(rows[0].bars[0]).toMatchObject({ start: 0, end: 0.5, checkout: true })
    })
    it("entra y sale el mismo día: ocupa ese día entero (caben las dos marcas); solo un extremo en la vista: medio día", () => {
        const [same] = occupancyRows([res("d", "A", d(18), d(18))], start)
        expect(same.bars[0]).toMatchObject({ start: 2, end: 3, checkin: true, checkout: true })
        const [lastDay] = occupancyRows([res("u", "A", d(29), d(2, 11))], start)
        expect(lastDay.bars[0]).toMatchObject({ start: 13.5, end: 14, checkin: true, checkout: false })
    })
    it("sale una y entra otra el mismo día: mismo carril; dos que se cruzan: dos carriles", () => {
        const [seguidas] = occupancyRows([res("1", "A", d(16), d(19)), res("2", "A", d(19), d(22))], start)
        expect(seguidas.tracks).toBe(1)
        const [cruzadas] = occupancyRows([res("1", "A", d(16), d(20)), res("2", "A", d(18), d(22))], start)
        expect(cruzadas.tracks).toBe(2)
        expect(cruzadas.bars.map((b) => b.track)).toEqual([0, 1])
    })
    it("filas ordenadas por nombre como un diccionario (los números por valor)", () => {
        const rows = occupancyRows([res("1", "1205 Alcázar", d(17), d(19)), res("2", "201 Distrito", d(17), d(19)), res("3", "704 Casa", d(17), d(19))], start)
        expect(rows.map((r) => r.unitName)).toEqual(["201 Distrito", "704 Casa", "1205 Alcázar"])
    })
})

describe("ocupación: textos de la barra", () => {
    it("el titular y los huéspedes extra solo si la reserva los dice", () => {
        expect(guestText(res("1", "A", d(16), d(18), { guestName: "Andrés Núñez", totalGuests: 2 }))).toBe("Andrés Núñez +1")
        expect(guestText(res("1", "A", d(16), d(18), { guestName: "Kayla" }))).toBe("Kayla")
        expect(guestText(res("1", "A", d(16), d(18), { guestName: "  " }))).toBe("Huésped")
    })
    it("nombre accesible y detalle con las fechas; sin código de reserva inventado", () => {
        const r = res("1", "1201 Aiana Verde", d(16), d(18), { guestName: "Kayla", statusLabel: "Confirmada" })
        expect(stayLabel(r)).toBe("Kayla, 1201 Aiana Verde: check-in 16 oct 2026, checkout 18 oct 2026, 2 noches")
        expect(stayDetails(r)).toEqual([
            ["Alojamiento", "1201 Aiana Verde"], ["Propiedad", "Nomad House"], ["Check-in", "16 oct 2026"],
            ["Checkout", "18 oct 2026"], ["Duración", "2 noches"], ["Estado", "Confirmada"],
        ])
    })
    it("«Propiedad no disponible» no es un dato: ni subtítulo de la fila ni línea del detalle", () => {
        const r = res("1", "Alojamiento 1", d(16), d(18), { propertyName: "Propiedad no disponible" })
        expect(occupancyRows([r], d(16))[0].propertyName).toBe("")
        expect(stayDetails(r).map(([k]) => k)).not.toContain("Propiedad")
    })
    it("buscar por alojamiento, propiedad o huésped sin acentos", () => {
        const list = [res("1", "1202 Alcázar", d(16), d(18), { guestName: "Sebastián" }), res("2", "203 Distrito", d(16), d(18), { propertyId: "p2", propertyName: "Distrito Primavera" })]
        const none = new Set<string>()
        expect(filterReservations(list, { properties: none, units: none, query: "alcazar" }).map((r) => r.id)).toEqual(["1"])
        expect(filterReservations(list, { properties: none, units: none, query: "SEBASTIAN" }).map((r) => r.id)).toEqual(["1"])
    })
    it("filtros exactos de selección múltiple: varias propiedades, varios alojamientos; vacío = todos; se suman a la búsqueda", () => {
        const list = [
            res("1", "1202", d(16), d(18)),
            res("2", "1205", d(16), d(18)),
            res("3", "203", d(16), d(18), { propertyId: "p2" }),
            res("4", "204", d(16), d(18), { propertyId: "p3" }),
        ]
        const none = new Set<string>()
        const ids = (f: Parameters<typeof filterReservations>[1]) => filterReservations(list, f).map((r) => r.id)
        expect(ids({ properties: none, units: none, query: "" })).toEqual(["1", "2", "3", "4"])
        expect(ids({ properties: new Set(["p1", "p2"]), units: none, query: "" })).toEqual(["1", "2", "3"])
        expect(ids({ properties: none, units: new Set(["1202", "204"]), query: "" })).toEqual(["1", "4"])
        // Nombres parecidos: el filtro exacto distingue «1202» de «1205», la búsqueda «120» no.
        expect(ids({ properties: none, units: none, query: "120" })).toEqual(["1", "2"])
        expect(ids({ properties: none, units: new Set(["1205"]), query: "120" })).toEqual(["2"])
    })
})

describe("ocupación: selecciones de los filtros con una lista nueva", () => {
    const list = [
        res("1", "1202", d(16), d(18)),
        res("2", "1205", d(16), d(18)),
        res("3", "203", d(16), d(18), { propertyId: "p2" }),
    ]
    it("si nada cambió devuelve los mismos conjuntos (sin renders de más)", () => {
        const properties = new Set(["p1"]); const units = new Set(["1205"])
        const next = pruneSelection(list, properties, units)
        expect(next.properties).toBe(properties)
        expect(next.units).toBe(units)
    })
    it("un alojamiento que ya no está sale de la selección; una propiedad que ya no está, también", () => {
        const sinElAlojamiento = list.filter((r) => r.unitId !== "1205")
        expect([...pruneSelection(sinElAlojamiento, new Set(), new Set(["1205", "1202"])).units]).toEqual(["1202"])
        const sinLaPropiedad = list.filter((r) => r.propertyId !== "p2")
        expect([...pruneSelection(sinLaPropiedad, new Set(["p2", "p1"]), new Set()).properties]).toEqual(["p1"])
    })
    it("un alojamiento elegido que no pertenece a las propiedades elegidas sale", () => {
        expect([...pruneSelection(list, new Set(["p2"]), new Set(["1205", "203"])).units]).toEqual(["203"])
    })
})
