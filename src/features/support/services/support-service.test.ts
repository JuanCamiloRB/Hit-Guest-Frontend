import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/store/useLanguageStore", () => ({ useLanguageStore: { getState: () => ({ language: "es" }) } }))
vi.mock("@/lib/store/auth-store", () => ({ useAuthStore: { getState: () => ({ user: { token: "t-agente" } }) } }))

import { supportService } from "./support-service"

describe("supportService — listas paginadas", () => {
    afterEach(() => vi.unstubAllGlobals())

    it("mandan el token y el idioma, como el resto de las peticiones", async () => {
        // Un Response nuevo por llamada: el cuerpo de un Response solo se lee una vez.
        const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
            data: [], meta: { current_page: 1, last_page: 1, total: 0 },
        }), { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)

        await supportService.listClients({ search: "Rentals" })
        await supportService.listAgents()

        for (const [url, init] of fetchMock.mock.calls) {
            expect(String(url)).toMatch(/\/support\/(clients\?search=Rentals&page=1|agents\?page=1)$/)
            expect(init.headers).toMatchObject({ Authorization: "Bearer t-agente", "X-Locale": "es", "Accept-Language": "es" })
        }
    })

    it("un 2xx sin arreglo no es «no hay clientes»: es un error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "ok" }), { status: 200 })))
        await expect(supportService.listClients()).rejects.toThrow(/sin arreglo/)
    })
})
