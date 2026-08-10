import { describe, it, expect } from "vitest"
import { resolveMapView } from "./map-view"

describe("resolveMapView", () => {
    describe("sin ubicación definida", () => {
        // El caso que se reportó: dirección escrita a mano, sin coordenadas, y el
        // mapa mostrando un rectángulo azul uniforme (mar abierto a zoom de calle)
        // que parecía un mapa roto.
        it("no centra en (0,0): el default del esquema no es una ubicación", () => {
            const view = resolveMapView(0, 0)
            expect(view.hasCoordinates).toBe(false)
            expect([view.lat, view.lng]).not.toEqual([0, 0])
        })

        it("usa una vista amplia, no zoom de calle", () => {
            expect(resolveMapView(0, 0).zoom).toBeLessThan(resolveMapView(4.7, -74).zoom)
        })

        it("trata como sin definir las cadenas vacías y los nulos", () => {
            for (const [lat, lng] of [["", ""], [null, null], [undefined, undefined]]) {
                expect(resolveMapView(lat, lng).hasCoordinates).toBe(false)
            }
        })

        it("trata como sin definir lo que no es numérico", () => {
            expect(resolveMapView("abc", "def").hasCoordinates).toBe(false)
        })

        it("rechaza coordenadas fuera de rango", () => {
            expect(resolveMapView(91, 0).hasCoordinates).toBe(false)
            expect(resolveMapView(0, 181).hasCoordinates).toBe(false)
        })

        it("tolera el -0 y el '0.00000000' que devuelve el backend", () => {
            expect(resolveMapView(-0, -0).hasCoordinates).toBe(false)
            expect(resolveMapView("0.00000000", "0.00000000").hasCoordinates).toBe(false)
        })
    })

    describe("con ubicación real", () => {
        it("respeta las coordenadas y acerca a nivel de calle", () => {
            // Cali, Valle del Cauca — el caso del reporte una vez resuelto.
            const view = resolveMapView(3.4516, -76.532)
            expect(view).toMatchObject({ lat: 3.4516, lng: -76.532, hasCoordinates: true })
            expect(view.zoom).toBeGreaterThanOrEqual(15)
        })

        it("acepta coordenadas que llegan como cadena", () => {
            expect(resolveMapView("3.4516", "-76.532")).toMatchObject({
                lat: 3.4516,
                lng: -76.532,
                hasCoordinates: true,
            })
        })

        it("una sola coordenada distinta de cero ya cuenta (meridiano/ecuador)", () => {
            // Quito está casi en el ecuador: descartar por `lat === 0` sería un bug.
            expect(resolveMapView(0, -78.4678).hasCoordinates).toBe(true)
            expect(resolveMapView(51.4778, 0).hasCoordinates).toBe(true)
        })

        it("acepta los extremos válidos del rango", () => {
            expect(resolveMapView(-90, 180).hasCoordinates).toBe(true)
            expect(resolveMapView(90, -180).hasCoordinates).toBe(true)
        })
    })
})
