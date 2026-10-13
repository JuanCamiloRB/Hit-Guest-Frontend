import { describe, expect, it } from "vitest"
import {
    readPageMeta,
    readStartedSupportSession,
    readSupportAgent,
    readSupportClient,
    readSupportClientUser,
} from "./support-readers"

/** Payloads del contrato §9, capturados por backend contra la rama. */
const SESSION = {
    uuid: "01a127e0-f7a8-7085-ae2b-01f03346ca49",
    clientUuid: "01a127e0-f700-7253-bfa8-5c5460ecbdee",
    clientName: "Casa Rentals252a2",
    userUuid: "01a127e0-f72a-7335-a371-53f295174bc2",
    userName: "Ana Pérez",
    userEmail: "ana@casa.test",
    reason: "Ticket 77: revisar contrato",
    status: "active",
    idleTimeoutMinutes: 60,
    startedAt: "2026-10-10T17:13:37-05:00",
    lastActivityAt: "2026-10-10T17:13:37-05:00",
    expiresAt: "2026-10-10T18:13:37-05:00",
    endedAt: null,
    endReason: null,
}

describe("support-readers — formas del contrato §9", () => {
    it("lee el 201 de POST /support/sessions crudo y ya desenvuelto por apiClient", () => {
        const data = { token: "tok", session: SESSION, user: { uuid: "u-1", canAccessSupportConsole: false } }
        for (const raw of [{ message: "Support session started.", data }, data]) {
            const started = readStartedSupportSession(raw)
            expect(started?.token).toBe("tok")
            expect(started?.session).toMatchObject({ clientName: "Casa Rentals252a2", idleTimeoutMinutes: 60 })
            expect(started?.user).toMatchObject({ uuid: "u-1" })
        }
    })

    it("sin token, sin sesión o sin usuario no hay sesión utilizable", () => {
        expect(readStartedSupportSession({ data: { session: SESSION, user: {} } })).toBeNull()
        expect(readStartedSupportSession({ data: { token: "tok", user: {} } })).toBeNull()
        expect(readStartedSupportSession({ data: { token: "tok", session: SESSION } })).toBeNull()
    })

    it("cliente de la búsqueda", () => {
        expect(readSupportClient({
            uuid: "c-1", name: "Casa Rentals252a2", email: "contacto@casa.test", identificationNumber: "900123456", usersCount: 3,
        })).toEqual({ uuid: "c-1", name: "Casa Rentals252a2", email: "contacto@casa.test", identificationNumber: "900123456", usersCount: 3 })
        expect(readSupportClient({ name: "Sin uuid" })).toBeNull()
    })

    it("usuario del cliente: solo un canOpenSession true explícito habilita", () => {
        const carla = readSupportClientUser({
            uuid: "u-3", name: "Carla Sin Verificar", email: "carla@casa.test", role: "read_only",
            isAccountOwner: false, verified: false, canOpenSession: false,
        })
        expect(carla).toMatchObject({ canOpenSession: false, verified: false, role: "read_only" })
        expect(readSupportClientUser({ uuid: "u-4", name: "Sin flag" })?.canOpenSession).toBe(false)
    })

    it("agente con y sin sesión abierta", () => {
        expect(readSupportAgent({ uuid: "a-1", name: "Laura Gómez", email: "laura@x.test", createdAt: "2026-10-10T17:13:37-05:00", activeSession: null }))
            .toMatchObject({ name: "Laura Gómez", activeSession: null })
        expect(readSupportAgent({ uuid: "a-1", name: "Laura", activeSession: SESSION })?.activeSession)
            .toMatchObject({ clientName: "Casa Rentals252a2", userName: "Ana Pérez" })
    })

    it("meta de la paginación de Laravel", () => {
        expect(readPageMeta({ meta: { current_page: 2, last_page: 3, per_page: 15, total: 40 } }, 15))
            .toEqual({ currentPage: 2, lastPage: 3, total: 40 })
    })
})
