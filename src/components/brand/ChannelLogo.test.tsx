import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { siAirbnb, siBookingdotcom, siExpedia, siTripdotcom, siGooglecalendar, siGoogleads } from "simple-icons"
import { ChannelLogo, channelBrand } from "./ChannelLogo"

describe("ChannelLogo — logos reales de los canales", () => {
    it("reconoce el slug del backend y el nombre visible como la misma marca", () => {
        expect(channelBrand("airbnb")).toBe("airbnb")
        expect(channelBrand("Booking")).toBe("booking")
        expect(channelBrand("Booking.com")).toBe("booking")
        expect(channelBrand("booking_com")).toBe("booking")
        expect(channelBrand("Directo")).toBe("direct")
        expect(channelBrand("Expedia")).toBe("expedia")
        expect(channelBrand("Trip.com")).toBe("tripcom")
        expect(channelBrand("trip_com")).toBe("tripcom")
        expect(channelBrand("Google Calendar")).toBe("googlecalendar")
        expect(channelBrand("Google Ads")).toBe("googleads")
    })

    it("pinta el SVG de la marca (Simple Icons), con su color", () => {
        for (const [channel, icon] of [["Airbnb", siAirbnb], ["Booking.com", siBookingdotcom], ["Expedia", siExpedia], ["Trip.com", siTripdotcom], ["Google Calendar", siGooglecalendar], ["Google Ads", siGoogleads]] as const) {
            const { container, unmount } = render(<ChannelLogo channel={channel} />)
            expect(container.querySelector("path")?.getAttribute("d")).toBe(icon.path)
            unmount()
        }
    })

    it("sin logo de marca (KunasPMS, Vrbo, Despegar, Agoda) usa el ícono neutro, nunca uno inventado", () => {
        for (const name of ["KunasPMS", "Vrbo", "Despegar", "Agoda"]) expect(channelBrand(name)).toBeNull()
        const { container } = render(<ChannelLogo channel="KunasPMS" />)
        expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-slate-400")
    })

    it("es decorativo: el nombre va al lado", () => {
        const { container } = render(<ChannelLogo channel="Airbnb" />)
        expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
    })
})
