import { describe, it, expect, vi } from "vitest"
import { ApiError } from "@/types/api"
import {
    UnitOverridesConfirmationDeclined,
    readUnitOverridesConfirmation,
    withUnitOverridesConfirmation,
} from "./unit-overrides-confirmation"

/** El 422 del contrato 2026-10-20 §2.5, tal cual lo documenta el backend. */
function confirmationError() {
    return new ApiError(422, {
        message: "Este cambio reemplaza la configuración del contrato de algunas unidades. Revisa cuáles y confirma para aplicarlo. (and 1 more error)",
        errors: {
            confirmUnitOverrides: [
                "Este cambio reemplaza la configuración del contrato de algunas unidades. Revisa cuáles y confirma para aplicarlo.",
                "Apartamento 101: su firma propia quedará sin texto para Booking.com, y sus huéspedes no firmarán contrato hasta que lo crees.",
            ],
        },
        meta: {
            affectedUnits: [{
                listingUuid: "unit-101",
                listingName: "Apartamento 101",
                replacedTexts: [],
                channelsLeftWithoutText: [{ id: 23, slug: "booking", name: "Booking.com" }],
            }],
        },
    })
}

describe("readUnitOverridesConfirmation", () => {
    it("lee las frases y las unidades afectadas", () => {
        const request = readUnitOverridesConfirmation(confirmationError())
        expect(request?.messages).toHaveLength(2)
        expect(request?.affectedUnits).toEqual([{
            listingUuid: "unit-101",
            listingName: "Apartamento 101",
            replacedTexts: [],
            channelsLeftWithoutText: [{ id: 23, slug: "booking", name: "Booking.com" }],
        }])
    })

    it("se reconoce por la CLAVE, no por el texto: otro 422 con el mismo mensaje no lo es", () => {
        const other = new ApiError(422, {
            message: "Este cambio reemplaza la configuración del contrato de algunas unidades.",
            errors: { content: ["Este cambio reemplaza la configuración del contrato de algunas unidades."] },
        })
        expect(readUnitOverridesConfirmation(other)).toBeNull()
    })

    it("acepta `errors` como lista de objetos y tolera un `meta` ausente o mal formado", () => {
        const error = new ApiError(422, { message: "x", errors: [{ confirmUnitOverrides: ["Intro"] }], meta: "nope" })
        expect(readUnitOverridesConfirmation(error)).toEqual({ messages: ["Intro"], affectedUnits: [] })
    })

    it("«Todos los canales» llega con id null", () => {
        const error = new ApiError(422, {
            message: "x",
            errors: { confirmUnitOverrides: ["Intro"] },
            meta: { affectedUnits: [{ listingUuid: "u", listingName: "Casa", replacedTexts: [{ uuid: "t1", channel: { id: null, slug: "all" } }], channelsLeftWithoutText: [] }] },
        })
        expect(readUnitOverridesConfirmation(error)?.affectedUnits[0].replacedTexts).toEqual([
            { uuid: "t1", channel: { id: null, slug: "all", name: "Todos los canales" } },
        ])
    })

    it("no es confirmación si no es un 422 de la API", () => {
        expect(readUnitOverridesConfirmation(new Error("red"))).toBeNull()
        expect(readUnitOverridesConfirmation(new ApiError(500, { message: "x", errors: { confirmUnitOverrides: ["x"] } }))).toBeNull()
    })
})

describe("withUnitOverridesConfirmation", () => {
    it("sin pedido de confirmación, una sola petición sin la marca", async () => {
        const write = vi.fn().mockResolvedValue("ok")
        const ask = vi.fn()
        await expect(withUnitOverridesConfirmation(write, ask)).resolves.toBe("ok")
        expect(write).toHaveBeenCalledWith(false)
        expect(ask).not.toHaveBeenCalled()
    })

    it("si el PM confirma, reenvía LA MISMA petición con la marca", async () => {
        const write = vi.fn().mockRejectedValueOnce(confirmationError()).mockResolvedValueOnce("ok")
        const ask = vi.fn().mockResolvedValue(true)
        await expect(withUnitOverridesConfirmation(write, ask)).resolves.toBe("ok")
        expect(write.mock.calls).toEqual([[false], [true]])
        expect(ask.mock.calls[0][0].affectedUnits[0].listingName).toBe("Apartamento 101")
    })

    it("si cancela, no reenvía nada", async () => {
        const write = vi.fn().mockRejectedValueOnce(confirmationError())
        await expect(withUnitOverridesConfirmation(write, async () => false)).rejects.toBeInstanceOf(UnitOverridesConfirmationDeclined)
        expect(write).toHaveBeenCalledTimes(1)
    })

    it("cualquier otro error sigue su camino sin preguntar", async () => {
        const other = new ApiError(422, { message: "x", errors: { content: ["Falta el texto"] } })
        const ask = vi.fn()
        await expect(withUnitOverridesConfirmation(vi.fn().mockRejectedValue(other), ask)).rejects.toBe(other)
        expect(ask).not.toHaveBeenCalled()
    })
})
