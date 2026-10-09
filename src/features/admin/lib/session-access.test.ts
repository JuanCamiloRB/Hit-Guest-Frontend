import { describe, expect, it } from "vitest"
import { ADMIN_CAPABILITIES, hasCapability, readCapabilities, readImpersonation, readRoles } from "./session-access"

describe("session-access — solo valores explícitos dan acceso", () => {
    it("lee capacidades y descarta lo que no es texto", () => {
        expect(readCapabilities({ capabilities: ["admin.clients.read", 7, "", null] })).toEqual(["admin.clients.read"])
        expect(readCapabilities({})).toEqual([])
        expect(readCapabilities(null)).toEqual([])
    })

    it("roles como arreglo; un `role` suelto cuenta como uno", () => {
        expect(readRoles({ roles: ["super_admin"] })).toEqual(["super_admin"])
        expect(readRoles({ role: "property_staff" })).toEqual(["property_staff"])
        expect(readRoles({})).toEqual([])
    })

    it("sin la capacidad exacta no hay acceso — tampoco por un rol ni por el correo", () => {
        expect(hasCapability({ capabilities: ["admin.clients.read"] }, ADMIN_CAPABILITIES.clientsRead)).toBe(true)
        expect(hasCapability({ capabilities: [] }, ADMIN_CAPABILITIES.clientsRead)).toBe(false)
        expect(hasCapability({}, ADMIN_CAPABILITIES.clientsRead)).toBe(false)
        expect(hasCapability(null, ADMIN_CAPABILITIES.clientsRead)).toBe(false)
    })

    it("el bloque de suplantación exige id; cualquier modo que no sea `full` es solo lectura", () => {
        expect(readImpersonation({ impersonation: { id: "imp-1", actorEmail: "soporte@x.com", mode: "full", expiresAt: "2026-10-09T16:04:00Z" } }))
            .toMatchObject({ id: "imp-1", actorEmail: "soporte@x.com", mode: "full", expiresAt: "2026-10-09T16:04:00Z" })
        expect(readImpersonation({ impersonation: { id: "imp-1", mode: "algo-raro" } })?.mode).toBe("read_only")
        expect(readImpersonation({ impersonation: { mode: "full" } })).toBeNull()
        expect(readImpersonation({ impersonation: null })).toBeNull()
    })
})
