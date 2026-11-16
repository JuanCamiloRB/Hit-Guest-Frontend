import { describe, expect, it } from "vitest"
import { postLoginDestination } from "./use-login"
import { SUPPORT_HOME } from "@/features/support/lib/support-session"

describe("postLoginDestination — volver a donde iba (enlace del correo, nota 2026-11-11)", () => {
    const pm = { canAccessSupportConsole: false }
    const agent = { canAccessSupportConsole: true, canManageSupportAgents: false }

    it("un PM vuelve al destino validado", () => {
        expect(postLoginDestination(pm, "?returnTo=%2Fdashboard%2Fproperties%2Fabc%3Ftab%3Dautomations"))
            .toBe("/dashboard/properties/abc?tab=automations")
    })

    it("sin destino, o con uno fuera del panel, al inicio", () => {
        expect(postLoginDestination(pm, "")).toBe("/dashboard")
        expect(postLoginDestination(pm, "?returnTo=https%3A%2F%2Fevil.example")).toBe("/dashboard")
    })

    it("un agente de soporte va a su consola aunque traiga destino", () => {
        expect(postLoginDestination(agent, "?returnTo=%2Fdashboard%2Fproperties%2Fabc")).toBe(SUPPORT_HOME)
    })
})
