import { describe, expect, it } from "vitest"
import { extractAirbnbListingId } from "./ical"

describe("extractAirbnbListingId", () => {
    it("saca el ID de la URL real de exportar calendario", () => {
        expect(extractAirbnbListingId("https://www.airbnb.com/calendar/ical/12345678.ics?s=abc"))
            .toBe("12345678")
    })

    it("sin el patrón no inventa nada", () => {
        expect(extractAirbnbListingId("https://airbnb.com/rooms/12345678")).toBeNull()
        expect(extractAirbnbListingId("")).toBeNull()
    })
})
