import { describe, expect, it } from "vitest"
import {
    describeImpersonationError,
    readAdminClient,
    readAdminClientUser,
    readPageMeta,
    readStartedImpersonation,
} from "./admin-readers"

describe("admin-readers — la forma pedida, sin inventar lo que falta", () => {
    it("cliente con dueño anidado, saldo y conteos", () => {
        expect(readAdminClient({
            uuid: "c-1", name: "Pullman Miami SAS", status: "active",
            owner: { uuid: "u-1", name: "Didier", email: "didier@x.com" },
            balance: { amount: 6.49, currency: "USD" },
            counts: { users: 3, properties: 8 },
            createdAt: "2026-07-01T10:00:00Z",
        })).toMatchObject({
            uuid: "c-1", owner: { email: "didier@x.com" }, balance: { amount: 6.49, currency: "USD" },
            counts: { users: 3, properties: 8, listings: null, reservations: null },
        })
    })

    it("acepta el dueño plano y conteos sueltos; sin uuid no hay cliente", () => {
        const client = readAdminClient({ uuid: "c-2", name: "Villa", ownerEmail: "o@x.com", propertiesCount: 2 })
        expect(client?.owner).toEqual({ uuid: null, name: null, email: "o@x.com" })
        expect(client?.counts.properties).toBe(2)
        expect(client?.balance).toBeNull()
        expect(readAdminClient({ name: "Sin uuid" })).toBeNull()
    })

    it("usuario: roles como arreglo, `role` suelto como respaldo, dueño explícito", () => {
        expect(readAdminClientUser({ uuid: "u-1", name: "Didier", isAccountOwner: true, roles: ["property_manager"] }))
            .toMatchObject({ isAccountOwner: true, roles: ["property_manager"] })
        expect(readAdminClientUser({ uuid: "u-2", email: "r@x.com", role: "property_staff" }))
            .toMatchObject({ name: "r@x.com", isAccountOwner: false, roles: ["property_staff"] })
    })

    it("meta de paginación con valores sanos por defecto", () => {
        expect(readPageMeta({ meta: { current_page: 2, last_page: 5, total: 70 } }, 15)).toEqual({ currentPage: 2, lastPage: 5, total: 70 })
        expect(readPageMeta({}, 3)).toEqual({ currentPage: 1, lastPage: 1, total: 3 })
    })

    it("suplantación iniciada: con o sin envoltorio `data`; sin token o sin usuario no sirve", () => {
        const body = { id: "imp-1", token: "t-imp", mode: "read_only", expiresAt: "2026-10-09T16:04:00Z", user: { uuid: "u-1" } }
        expect(readStartedImpersonation({ data: body })).toMatchObject({ id: "imp-1", token: "t-imp", mode: "read_only" })
        expect(readStartedImpersonation(body)?.token).toBe("t-imp")
        expect(readStartedImpersonation({ ...body, token: "" })).toBeNull()
        expect(readStartedImpersonation({ ...body, user: null })).toBeNull()
    })

    it("cada rechazo documentado tiene mensaje propio; uno desconocido usa el del backend", () => {
        expect(describeImpersonationError("IMPERSONATION_FULL_FORBIDDEN")).toMatch(/escritura/)
        expect(describeImpersonationError("NESTED_IMPERSONATION_FORBIDDEN")).toMatch(/Vuelve a la tuya/)
        expect(describeImpersonationError("ALGO_NUEVO")).toBeNull()
        expect(describeImpersonationError(undefined)).toBeNull()
    })
})
