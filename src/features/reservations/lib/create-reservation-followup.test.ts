import { describe, expect, it, vi } from "vitest"
import { createReservationWithFollowUp, followUpCreatedReservation, readCreatedReservationUuid } from "./create-reservation-followup"

describe("readCreatedReservationUuid — la respuesta documentada y sus variantes", () => {
    it("lee la forma que ENTREGA apiClient (que desenvuelve `data`): { reservation: { uuid } }", () => {
        expect(readCreatedReservationUuid({ reservation: { uuid: "r-1" } })).toBe("r-1")
    })

    it("tolera el JSON crudo documentado y las formas planas", () => {
        expect(readCreatedReservationUuid({ success: true, data: { reservation: { uuid: "r-1" } } })).toBe("r-1")
        expect(readCreatedReservationUuid({ data: { uuid: "r-2" } })).toBe("r-2")
        expect(readCreatedReservationUuid({ uuid: "r-3" })).toBe("r-3")
    })

    it("sin uuid no inventa uno", () => {
        expect(readCreatedReservationUuid({ success: true, data: {} })).toBeNull()
        expect(readCreatedReservationUuid(null)).toBeNull()
    })
})

describe("followUpCreatedReservation — la casilla «enviar link ahora» hace lo que dice", () => {
    const base = {
        createdUuid: "r-1",
        guestName: "Ana Gómez",
        email: "ana@correo.com",
        describeError: (e: unknown) => (e instanceof Error ? e.message : "Error"),
    }

    it("sin la casilla no envía nada y lo dice", async () => {
        const sendLink = vi.fn()
        const outcome = await followUpCreatedReservation({ ...base, sendLinkNow: false, sendLink })
        expect(sendLink).not.toHaveBeenCalled()
        expect(outcome).toMatchObject({ tone: "success", description: expect.stringMatching(/Link no enviado/) })
    })

    it("con la casilla llama al endpoint real de envío con el uuid creado", async () => {
        const sendLink = vi.fn().mockResolvedValue("Link de check-in enviado")
        const outcome = await followUpCreatedReservation({ ...base, sendLinkNow: true, sendLink })
        expect(sendLink).toHaveBeenCalledWith("r-1")
        expect(outcome.tone).toBe("success")
        expect(outcome.description).toContain("ana@correo.com")
        // El 200 es «encolado», no entregado: el título no puede afirmar entrega.
        expect(outcome.title).toMatch(/solicitado/)
        expect(outcome.title).not.toMatch(/enviado$/)
    })

    it("si el envío falla, la reserva queda creada y se avisa con el motivo del backend — nunca «se enviará»", async () => {
        const sendLink = vi.fn().mockRejectedValue(new Error("La reserva no tiene email del huésped."))
        const outcome = await followUpCreatedReservation({ ...base, sendLinkNow: true, sendLink })
        expect(outcome.tone).toBe("warning")
        expect(outcome.title).toMatch(/no se envió/)
        expect(outcome.description).toContain("La reserva no tiene email del huésped.")
        expect(outcome.description).not.toMatch(/se enviará/i)
    })

    it("sin uuid en la respuesta no intenta enviar y manda a la ficha", async () => {
        const sendLink = vi.fn()
        const outcome = await followUpCreatedReservation({ ...base, sendLinkNow: true, createdUuid: null, sendLink })
        expect(sendLink).not.toHaveBeenCalled()
        expect(outcome.tone).toBe("warning")
    })
})

describe("createReservationWithFollowUp — cableado completo con lo que entrega apiClient", () => {
    const input = { payload: { listingUuid: "l-1" }, guestName: "Ana Gómez", email: "ana@correo.com" }
    const describeError = (e: unknown) => (e instanceof Error ? e.message : "Error")

    it("con la casilla marcada: POST, uuid de la forma desenvuelta, y UNA sola llamada de envío", async () => {
        const post = vi.fn().mockResolvedValue({ reservation: { uuid: "r-1", external_id: "MANUAL-X" } })
        const sendLink = vi.fn().mockResolvedValue("Link de check-in enviado")
        const outcome = await createReservationWithFollowUp({ ...input, sendLinkNow: true }, { post, sendLink, describeError })
        expect(post).toHaveBeenCalledTimes(1)
        expect(post.mock.calls[0][0]).toMatch(/\/reservations$/)
        expect(sendLink).toHaveBeenCalledTimes(1)
        expect(sendLink).toHaveBeenCalledWith("r-1")
        expect(outcome.tone).toBe("success")
    })

    it("con la casilla apagada crea la reserva y NO llama al envío", async () => {
        const post = vi.fn().mockResolvedValue({ reservation: { uuid: "r-1" } })
        const sendLink = vi.fn()
        const outcome = await createReservationWithFollowUp({ ...input, sendLinkNow: false }, { post, sendLink, describeError })
        expect(post).toHaveBeenCalledTimes(1)
        expect(sendLink).not.toHaveBeenCalled()
        expect(outcome.description).toMatch(/Link no enviado/)
    })

    it("si el POST falla, el error sube y no se intenta ningún envío", async () => {
        const post = vi.fn().mockRejectedValue(new Error("422"))
        const sendLink = vi.fn()
        await expect(createReservationWithFollowUp({ ...input, sendLinkNow: true }, { post, sendLink, describeError })).rejects.toThrow("422")
        expect(sendLink).not.toHaveBeenCalled()
    })
})
