import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AddressAutocomplete, type PlaceDetails } from "./AddressAutocomplete"

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("AddressAutocomplete free native search", () => {
    it("busca explícitamente, muestra recomendaciones y conserva la unidad", async () => {
        const onSelect = vi.fn()
        const details: PlaceDetails = {
            lat: -37.7996,
            lng: 144.8951,
            formattedAddress: "188 Ballarat Road, Footscray, Victoria, Australia",
            addressLine1: "188 Ballarat Road",
            addressLine2: "",
            streetNumber: "188",
            streetName: "Ballarat Road",
            city: "Melbourne",
            suburb: "Footscray",
            state: "Victoria",
            postalCode: "3011",
            countryCode: "AU",
        }
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                json: async () => ({
                    suggestions: [],
                    unavailable: true,
                    reason: "manual_search_required",
                    manualSearchAvailable: true,
                }),
            })
            .mockResolvedValueOnce({
                json: async () => ({
                    suggestions: [{
                        placeId: "W123",
                        description: details.formattedAddress,
                        details,
                    }],
                    provider: "nominatim",
                }),
            })
        vi.stubGlobal("fetch", fetchMock)

        function ControlledAddress() {
            const [value, setValue] = useState("")
            return (
                <AddressAutocomplete
                    value={value}
                    onChange={setValue}
                    onSelect={onSelect}
                />
            )
        }

        render(<ControlledAddress />)
        fireEvent.change(screen.getByRole("textbox"), {
            target: { value: "907/188 Ballarat Rd Footscray" },
        })

        const searchButton = await screen.findByRole("button", { name: "Buscar dirección" })
        fireEvent.click(searchButton)

        const suggestion = await screen.findByRole("button", {
            name: /907\/188 Ballarat Road/i,
        })
        expect(String(fetchMock.mock.calls[1][0])).toContain("mode=search")
        fireEvent.click(suggestion)

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
            addressLine1: "188 Ballarat Road",
            addressLine2: "907",
            streetNumber: "188",
            streetName: "Ballarat Road",
        })))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
