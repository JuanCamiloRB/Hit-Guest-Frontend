import { describe, expect, it } from "vitest"
import { loginHref, readReturnTo, safeReturnTo } from "./return-to"

describe("safeReturnTo", () => {
    it("acepta rutas del panel con su query", () => {
        expect(safeReturnTo("/dashboard")).toBe("/dashboard")
        expect(safeReturnTo("/dashboard/properties/abc?tab=automations")).toBe("/dashboard/properties/abc?tab=automations")
        expect(safeReturnTo("/dashboard/settings?tab=integrations")).toBe("/dashboard/settings?tab=integrations")
    })

    it("rechaza todo lo que saldría del panel o del sitio", () => {
        for (const bad of [
            "https://evil.example/dashboard",
            "//evil.example/dashboard",
            "/\\evil.example",
            "/dashboard\\..\\login",
            "javascript:alert(1)",
            "/login",
            "/dashboardx",
            "/dashboard/../login",
            "/dashboard/%2e%2e/login",
            "/dashboard\n/x",
            "",
            null,
            undefined,
        ]) {
            expect(safeReturnTo(bad as string | null | undefined), String(bad)).toBeNull()
        }
    })
})

describe("loginHref / readReturnTo", () => {
    it("ida y vuelta: el destino sobrevive codificado", () => {
        const href = loginHref("/dashboard/properties/abc?tab=automations")
        expect(href).toBe("/login?returnTo=%2Fdashboard%2Fproperties%2Fabc%3Ftab%3Dautomations")
        expect(readReturnTo(href.slice("/login".length))).toBe("/dashboard/properties/abc?tab=automations")
    })

    it("fuera del panel, el login va sin destino", () => {
        expect(loginHref("/register")).toBe("/login")
        expect(readReturnTo("?returnTo=https%3A%2F%2Fevil.example")).toBeNull()
    })
})
